import { randomUUID } from "node:crypto";

import type { DeviceRecord } from "@jenix/shared";

import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { deviceRepository } from "../devices/device.model";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import type { DeviceRequestContext } from "../devices/device.types";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";

import { smartRfLogRepository, smartRfProfileRepository } from "./smart-rf-transmitter.model";
import type {
  SmartRfButtonProfile,
  SmartRfCommandLogRecord,
  SmartRfLogSource,
  SmartRfProfileInput
} from "./smart-rf-transmitter.types";
import { SmartRfTransmitterModuleError } from "./smart-rf-transmitter.types";
import {
  parseConfigPatchPayload,
  parseOtaUrlPayload,
  parseProfilePayload,
  parseSequencePayload,
  parseTriggerPayload
} from "./smart-rf-transmitter.validation";

export const defaultSmartRfTopicRoot = "jenixone/v1/transmitters";
const oneWayRfWarning =
  "433 MHz RF command is one-way. Load status is assumed unless a separate receiver confirms it.";

/** Config/OTA/reboot are privileged — same bar as factory_reset elsewhere. */
const restrictedActions = new Set(["update_config", "request_ota", "reboot"]);

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function stripHex(value: string): string {
  return value.replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "").toUpperCase();
}

function padHex(value: string, width: number): string {
  const cleaned = stripHex(value || "0").slice(-width).padStart(width, "0");
  return `0x${cleaned}`;
}

function composeEv1527Code(remoteIdHex: string, buttonCode: number): string {
  const remoteId = parseInt(stripHex(remoteIdHex || "0"), 16) & 0xfffff;
  const code = ((remoteId << 4) | (buttonCode & 0x0f)) >>> 0;
  return `0x${code.toString(16).toUpperCase().padStart(6, "0")}`;
}

async function resolveDeviceContext(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ device: DeviceRecord; context: DeviceRequestContext }> {
  let resolvedContext: DeviceRequestContext;

  try {
    resolvedContext = await resolveHomeAccessContext(context);
  } catch (error) {
    if (error instanceof HomeModuleError) {
      throw new SmartRfTransmitterModuleError(error.statusCode, error.message);
    }

    throw error;
  }

  const device = await deviceRepository.get(normalizeDeviceId(deviceId));

  if (!device) {
    throw new SmartRfTransmitterModuleError(
      404,
      `Device not found: ${normalizeDeviceId(deviceId)}`
    );
  }

  if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
    throw new SmartRfTransmitterModuleError(403, "Device access denied");
  }

  if (
    !resolvedContext.homeRole &&
    resolvedContext.userId &&
    device.ownerUserId !== resolvedContext.userId
  ) {
    throw new SmartRfTransmitterModuleError(403, "Device access denied");
  }

  return { device, context: resolvedContext };
}

function requireOwnerOrAdmin(context: DeviceRequestContext, action: string) {
  if (
    restrictedActions.has(action) &&
    context.homeRole !== "owner" &&
    context.homeRole !== "admin"
  ) {
    throw new SmartRfTransmitterModuleError(
      403,
      `Restricted action requires owner/admin access: ${action}`
    );
  }
}

function normalizeProfile(
  deviceId: string,
  input: SmartRfProfileInput,
  existing: SmartRfButtonProfile | undefined
): SmartRfButtonProfile {
  const profileId = Math.trunc(input.profileId);

  if (!Number.isFinite(profileId) || profileId <= 0) {
    throw new SmartRfTransmitterModuleError(400, "profileId must be a positive integer");
  }

  const remoteIdHex = padHex(input.remoteIdHex ?? existing?.remoteIdHex ?? "0", 5);
  const buttonCode = Math.max(
    0,
    Math.min(15, Math.trunc(input.buttonCode ?? existing?.buttonCode ?? 0))
  );
  const timestamp = nowIso();

  return {
    profileId,
    deviceId,
    enabled: input.enabled ?? existing?.enabled ?? true,
    name: (input.name ?? existing?.name ?? `RF Button ${profileId}`).trim(),
    rfCodeHex: input.rfCodeHex
      ? padHex(input.rfCodeHex, 6)
      : (existing?.rfCodeHex ?? composeEv1527Code(remoteIdHex, buttonCode)),
    remoteIdHex,
    buttonCode,
    bitLength: Math.max(1, Math.trunc(input.bitLength ?? existing?.bitLength ?? 24)),
    pulseWidthUs: Math.max(50, Math.trunc(input.pulseWidthUs ?? existing?.pulseWidthUs ?? 350)),
    repeatCount: Math.max(1, Math.trunc(input.repeatCount ?? existing?.repeatCount ?? 12)),
    pulseDurationMs: Math.max(
      0,
      Math.trunc(input.pulseDurationMs ?? existing?.pulseDurationMs ?? 500)
    ),
    cooldownMs: Math.max(0, Math.trunc(input.cooldownMs ?? existing?.cooldownMs ?? 0)),
    mode: input.mode ?? existing?.mode ?? "INCHING",
    assumedStateAfterTrigger:
      input.assumedStateAfterTrigger ?? existing?.assumedStateAfterTrigger ?? "COMMAND_SENT",
    persistState: input.persistState ?? existing?.persistState ?? false,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
}

function appendLog(
  deviceId: string,
  entry: Omit<SmartRfCommandLogRecord, "logId" | "deviceId" | "timestamp">
): Promise<void> {
  return smartRfLogRepository.append({
    logId: randomUUID(),
    deviceId,
    timestamp: nowIso(),
    ...entry
  });
}

async function dispatchLegacyCommand(
  device: DeviceRecord,
  actionSuffix: string,
  payload: Record<string, unknown>,
  action: string,
  source: SmartRfLogSource,
  userId: string | undefined,
  detail: string | undefined
): Promise<{ commandId: string; dispatched: boolean }> {
  const commandId =
    typeof payload.requestId === "string" && payload.requestId.trim()
      ? payload.requestId.trim()
      : randomUUID();
  const bridge = getRuntimeMqttBridge();
  const topicRoot = defaultSmartRfTopicRoot;
  let dispatched = false;

  if (bridge?.publishLegacyDeviceCommand) {
    await bridge.publishLegacyDeviceCommand({
      topicRoot,
      deviceId: device.deviceId,
      actionSuffix,
      payload: { ...payload, requestId: commandId }
    });
    dispatched = true;
  }

  await appendLog(device.deviceId, {
    level: "info",
    action,
    source,
    topic: `${topicRoot}/${device.deviceId}/cmd/${actionSuffix}`,
    requestId: commandId,
    ...(userId ? { userId } : {}),
    ...(detail ? { detail } : {}),
    payload: { ...payload, requestId: commandId }
  });

  return { commandId, dispatched };
}

export async function listProfiles(
  deviceId: string,
  context: DeviceRequestContext
): Promise<SmartRfButtonProfile[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return smartRfProfileRepository.listByDevice(device.deviceId);
}

export async function upsertProfile(
  deviceId: string,
  profileId: number,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string; profile: SmartRfButtonProfile }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseProfilePayload(profileId, input);

  if (!parsed.ok) {
    throw new SmartRfTransmitterModuleError(400, parsed.errors.join("; "));
  }

  const existing = await smartRfProfileRepository.get(device.deviceId, profileId);
  const profile = normalizeProfile(device.deviceId, parsed.data, existing);
  await smartRfProfileRepository.save(profile);

  const { commandId } = await dispatchLegacyCommand(
    device,
    "profile/upsert",
    { ...profile },
    existing ? "UPDATE_PROFILE" : "CREATE_PROFILE",
    "PWA",
    resolvedContext.userId,
    profile.name
  );

  return { commandId, profile };
}

export async function deleteProfile(
  deviceId: string,
  profileId: number,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const existing = await smartRfProfileRepository.get(device.deviceId, profileId);

  if (!existing) {
    throw new SmartRfTransmitterModuleError(404, `profileId ${profileId} not found`);
  }

  await smartRfProfileRepository.remove(device.deviceId, profileId);
  const { commandId } = await dispatchLegacyCommand(
    device,
    "profile/delete",
    { profileId },
    "DELETE_PROFILE",
    "PWA",
    resolvedContext.userId,
    existing.name
  );

  return { commandId };
}

export async function triggerProfile(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseTriggerPayload(input);

  if (!parsed.ok) {
    throw new SmartRfTransmitterModuleError(400, parsed.errors.join("; "));
  }

  const profile = await smartRfProfileRepository.get(device.deviceId, parsed.data.profileId);

  if (!profile) {
    throw new SmartRfTransmitterModuleError(404, `profileId ${parsed.data.profileId} not found`);
  }

  const { commandId } = await dispatchLegacyCommand(
    device,
    "trigger",
    { profileId: parsed.data.profileId, action: parsed.data.action },
    "TRIGGER_PROFILE",
    "PWA",
    resolvedContext.userId,
    profile.name
  );

  return { commandId };
}

export async function runSequence(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseSequencePayload(input);

  if (!parsed.ok) {
    throw new SmartRfTransmitterModuleError(400, parsed.errors.join("; "));
  }

  const { commandId } = await dispatchLegacyCommand(
    device,
    "trigger",
    { profileIds: parsed.data.profileIds, delayMs: parsed.data.delayMs },
    "RUN_SEQUENCE",
    "PWA",
    resolvedContext.userId,
    `sequence:${parsed.data.profileIds.join(",")}`
  );

  return { commandId };
}

export async function updateConfig(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "update_config");
  const parsed = parseConfigPatchPayload(input);

  if (!parsed.ok) {
    throw new SmartRfTransmitterModuleError(400, parsed.errors.join("; "));
  }

  const { commandId } = await dispatchLegacyCommand(
    device,
    "config/update",
    { ...(parsed.data as Record<string, unknown>) },
    "UPDATE_CONFIG",
    "PWA",
    resolvedContext.userId,
    undefined
  );

  return { commandId };
}

export async function requestOta(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "request_ota");
  const parsed = parseOtaUrlPayload(input);

  if (!parsed.ok) {
    throw new SmartRfTransmitterModuleError(400, parsed.errors.join("; "));
  }

  const { commandId } = await dispatchLegacyCommand(
    device,
    "ota",
    { url: parsed.data.url },
    "REQUEST_OTA",
    "PWA",
    resolvedContext.userId,
    undefined
  );

  return { commandId };
}

export async function rebootDevice(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "reboot");

  const { commandId } = await dispatchLegacyCommand(
    device,
    "reboot",
    {},
    "REBOOT_DEVICE",
    "PWA",
    resolvedContext.userId,
    undefined
  );

  return { commandId };
}

export async function listLogs(
  deviceId: string,
  context: DeviceRequestContext
): Promise<SmartRfCommandLogRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return smartRfLogRepository.listByDevice(device.deviceId);
}

/** Legacy MQTT ingestion — called from runtime.handlers.ts, not a REST path. */
export async function ingestAvailability(
  deviceId: string,
  availability: "online" | "offline"
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  await deviceUiRuntimeStore.saveTelemetry({
    deviceId: normalizedDeviceId,
    pid: (await deviceRepository.get(normalizedDeviceId))?.pid ?? "",
    occurredAt: nowIso(),
    telemetry: { online: availability === "online", warning: oneWayRfWarning }
  });
}

export async function ingestStatus(
  deviceId: string,
  status: Record<string, unknown>
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const device = await deviceRepository.get(normalizedDeviceId);
  const telemetry: Record<string, boolean | number | string> = { online: true };

  for (const key of [
    "wifiConnected",
    "localIp",
    "productProfile",
    "savedButtons",
    "commandCount",
    "subscriptionsReady",
    "firmwareVersion"
  ]) {
    const value = status[key];

    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      telemetry[key] = value;
    }
  }

  await deviceUiRuntimeStore.saveTelemetry({
    deviceId: normalizedDeviceId,
    pid: device?.pid ?? "",
    occurredAt: nowIso(),
    telemetry
  });
}

export async function ingestAck(
  deviceId: string,
  ack: Record<string, unknown>
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  await appendLog(normalizedDeviceId, {
    level: ack.ok === false ? "error" : "info",
    action: "ACK",
    source: "MQTT",
    ...(typeof ack.commandTopic === "string" ? { topic: ack.commandTopic } : {}),
    ...(typeof ack.requestId === "string" ? { requestId: ack.requestId } : {}),
    detail:
      ack.ok === false ? String(ack.error ?? "Command failed") : "Device acknowledged command",
    payload: ack
  });
}

export const smartRfTransmitterTesting = {
  reset() {
    return Promise.all([
      smartRfProfileRepository.reset(),
      smartRfLogRepository.reset()
    ]).then(() => undefined);
  }
};
