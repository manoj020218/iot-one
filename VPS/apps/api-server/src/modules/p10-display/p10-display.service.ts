import { randomUUID } from "node:crypto";

import type { DeviceRecord } from "@jenix/shared";

import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { deviceRepository } from "../devices/device.model";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import type { DeviceRequestContext } from "../devices/device.types";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";

import { p10DisplayLogRepository } from "./p10-display.model";
import type { P10DisplayLogRecord, P10DisplayLogSource } from "./p10-display.types";
import { P10DisplayModuleError } from "./p10-display.types";
import {
  parseAnnouncePayload,
  parsePlayAnnouncementPayload,
  parseSetBrightnessPayload,
  parseSetCounterPayload,
  parseSetTokenPayload,
  parseTextPayload
} from "./p10-display.validation";

/** Real firmware topic — see BuildTopics() in mqtt_client.cpp. Unlike the
 *  Token Dispenser, this device's own NVS config literally stores the
 *  platform homeId, so no separate connection-label lookup is needed. */
export const p10DisplayTopicPrefix = "jenix/v1";

export const p10DisplayRawSubscriptions = [
  `${p10DisplayTopicPrefix}/+/+/telemetry`,
  `${p10DisplayTopicPrefix}/+/+/state`,
  `${p10DisplayTopicPrefix}/+/+/command/ack`
];

const restrictedActions = new Set(["factoryReset"]);

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

export function buildP10DisplayTopic(
  homeId: string,
  deviceId: string,
  suffix: "telemetry" | "state" | "command" | "command/ack"
): string {
  return [p10DisplayTopicPrefix, homeId, deviceId, suffix].join("/");
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
      throw new P10DisplayModuleError(error.statusCode, error.message);
    }

    throw error;
  }

  const device = await deviceRepository.get(normalizeDeviceId(deviceId));

  if (!device) {
    throw new P10DisplayModuleError(404, `Device not found: ${normalizeDeviceId(deviceId)}`);
  }

  if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
    throw new P10DisplayModuleError(403, "Device access denied");
  }

  if (
    !resolvedContext.homeRole &&
    resolvedContext.userId &&
    device.ownerUserId !== resolvedContext.userId
  ) {
    throw new P10DisplayModuleError(403, "Device access denied");
  }

  return { device, context: resolvedContext };
}

function requireOwnerOrAdmin(context: DeviceRequestContext, action: string) {
  if (
    restrictedActions.has(action) &&
    context.homeRole !== "owner" &&
    context.homeRole !== "admin"
  ) {
    throw new P10DisplayModuleError(
      403,
      `Restricted action requires owner/admin access: ${action}`
    );
  }
}

function appendLog(
  deviceId: string,
  entry: Omit<P10DisplayLogRecord, "logId" | "deviceId" | "timestamp">
): Promise<void> {
  return p10DisplayLogRepository.append({
    logId: randomUUID(),
    deviceId,
    timestamp: nowIso(),
    ...entry
  });
}

async function dispatchCommand(
  device: DeviceRecord,
  cmd: string,
  extra: Record<string, unknown>,
  action: string,
  userId: string | undefined
): Promise<{ requestId: string; dispatched: boolean }> {
  const topic = buildP10DisplayTopic(device.homeId, device.deviceId, "command");
  const requestId = randomUUID();
  const bridge = getRuntimeMqttBridge();
  let dispatched = false;

  if (bridge?.publishRaw) {
    await bridge.publishRaw(topic, { cmd, requestId, ...extra });
    dispatched = true;
  }

  await appendLog(device.deviceId, {
    level: "info",
    action,
    source: "PWA" as P10DisplayLogSource,
    requestId,
    ...(userId ? { userId } : {})
  });

  return { requestId, dispatched };
}

export async function setToken(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseSetTokenPayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "setToken",
    parsed.data,
    "setToken",
    resolvedContext.userId
  );
  return { requestId };
}

export async function nextToken(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseAnnouncePayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "nextToken",
    parsed.data,
    "nextToken",
    resolvedContext.userId
  );
  return { requestId };
}

export async function previousToken(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { requestId } = await dispatchCommand(
    device,
    "previousToken",
    {},
    "previousToken",
    resolvedContext.userId
  );
  return { requestId };
}

export async function resetToken(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { requestId } = await dispatchCommand(
    device,
    "resetToken",
    {},
    "resetToken",
    resolvedContext.userId
  );
  return { requestId };
}

export async function setCounter(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseSetCounterPayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "setCounter",
    parsed.data,
    "setCounter",
    resolvedContext.userId
  );
  return { requestId };
}

export async function showText(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseTextPayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "showText",
    parsed.data,
    "showText",
    resolvedContext.userId
  );
  return { requestId };
}

export async function scrollText(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseTextPayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "scrollText",
    parsed.data,
    "scrollText",
    resolvedContext.userId
  );
  return { requestId };
}

export async function setBrightness(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseSetBrightnessPayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "setBrightness",
    parsed.data,
    "setBrightness",
    resolvedContext.userId
  );
  return { requestId };
}

export async function playAnnouncement(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parsePlayAnnouncementPayload(input);

  if (!parsed.ok) {
    throw new P10DisplayModuleError(400, parsed.errors.join("; "));
  }

  const { requestId } = await dispatchCommand(
    device,
    "playAnnouncement",
    parsed.data,
    "playAnnouncement",
    resolvedContext.userId
  );
  return { requestId };
}

export async function rebootDevice(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { requestId } = await dispatchCommand(
    device,
    "rebootDevice",
    {},
    "rebootDevice",
    resolvedContext.userId
  );
  return { requestId };
}

export async function factoryReset(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ requestId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "factoryReset");
  const { requestId } = await dispatchCommand(
    device,
    "factoryReset",
    {},
    "factoryReset",
    resolvedContext.userId
  );
  return { requestId };
}

export async function listLogs(
  deviceId: string,
  context: DeviceRequestContext
): Promise<P10DisplayLogRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return p10DisplayLogRepository.listByDevice(device.deviceId);
}

/** Raw MQTT ingestion — called from runtime.handlers.ts, not a REST path. */
export async function ingestTelemetry(
  deviceId: string,
  telemetry: Record<string, unknown>
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const device = await deviceRepository.get(normalizedDeviceId);
  const snapshot: Record<string, boolean | number | string> = {};

  for (const key of [
    "firmwareVersion",
    "hardwareVersion",
    "uptime",
    "wifiRssi",
    "freeHeap",
    "p10PanelCount",
    "p10PanelColumns",
    "p10PanelRows",
    "p10PanelTotal",
    "brightness",
    "currentToken",
    "currentCounter",
    "displayMode",
    "announcementLanguage",
    "mqttStatus",
    "espNowStatus",
    "peerCount",
    "displayText"
  ]) {
    const value = telemetry[key];

    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      snapshot[key] = value;
    }
  }

  await deviceUiRuntimeStore.saveTelemetry({
    deviceId: normalizedDeviceId,
    pid: device?.pid ?? "",
    occurredAt: nowIso(),
    telemetry: snapshot
  });
}

export async function ingestState(
  deviceId: string,
  state: Record<string, unknown>
): Promise<void> {
  // Retained presence/status snapshot — same shape treatment as telemetry.
  await ingestTelemetry(deviceId, state);
}

export async function ingestCommandAck(
  deviceId: string,
  ack: Record<string, unknown>
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const requestId = typeof ack.requestId === "string" ? ack.requestId : undefined;
  const ok = ack.ok !== false;
  const reason = typeof ack.reason === "string" ? ack.reason : undefined;

  await appendLog(normalizedDeviceId, {
    level: ok ? "info" : "error",
    action: "ACK",
    source: "MQTT",
    ...(requestId ? { requestId } : {}),
    ...(reason ? { detail: reason } : {})
  });
}

export const p10DisplayTesting = {
  reset() {
    return p10DisplayLogRepository.reset();
  }
};
