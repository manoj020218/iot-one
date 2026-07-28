import { randomUUID } from "node:crypto";

import type { DeviceRecord } from "@jenix/shared";

import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { deviceRepository } from "../devices/device.model";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import type { DeviceRequestContext } from "../devices/device.types";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";

import { sosSirenLogRepository } from "./sos-siren.model";
import type { SosSirenDeviceCommand, SosSirenLogRecord, SosSirenLogSource } from "./sos-siren.types";
import { SosSirenModuleError } from "./sos-siren.types";
import {
  parseProfileIdPayload,
  parseTestProfilePayload,
  parseTestTonePayload,
  parseTriggerAlarmPayload
} from "./sos-siren.validation";

/**
 * PID of the Jenix Loud SOS Siren (see JNX-SOS-C3-001 delivery package). This
 * is the first device onboarded straight onto the frozen canonical scheme
 * (jnx/{tenantId}/{pid}/{deviceId}/{suffix}) with no adapter needed — because,
 * unlike every other device this session, there was no pre-existing real
 * wire contract to reconcile: MqttClientService.cpp is a complete no-op stub
 * (ENABLE_MQTT=0). See INTEGRATION.md for what that means for go-live.
 */
export const sosSirenPid = "JNX-SOS-C3-001";

const restrictedActions = new Set(["setSpeakerProfile", "factoryReset"]);

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
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
      throw new SosSirenModuleError(error.statusCode, error.message);
    }

    throw error;
  }

  const device = await deviceRepository.get(normalizeDeviceId(deviceId));

  if (!device) {
    throw new SosSirenModuleError(404, `Device not found: ${normalizeDeviceId(deviceId)}`);
  }

  if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
    throw new SosSirenModuleError(403, "Device access denied");
  }

  if (
    !resolvedContext.homeRole &&
    resolvedContext.userId &&
    device.ownerUserId !== resolvedContext.userId
  ) {
    throw new SosSirenModuleError(403, "Device access denied");
  }

  return { device, context: resolvedContext };
}

function requireOwnerOrAdmin(context: DeviceRequestContext, action: string) {
  if (
    restrictedActions.has(action) &&
    context.homeRole !== "owner" &&
    context.homeRole !== "admin"
  ) {
    throw new SosSirenModuleError(
      403,
      `Restricted action requires owner/admin access: ${action}`
    );
  }
}

function appendLog(
  deviceId: string,
  entry: Omit<SosSirenLogRecord, "logId" | "deviceId" | "timestamp">
): Promise<void> {
  return sosSirenLogRepository.append({
    logId: randomUUID(),
    deviceId,
    timestamp: nowIso(),
    ...entry
  });
}

async function dispatchCommand(
  device: DeviceRecord,
  command: SosSirenDeviceCommand,
  payload: Record<string, unknown> | undefined,
  action: string,
  userId: string | undefined
): Promise<{ deliveryId: string; dispatched: boolean }> {
  const deliveryId = randomUUID();
  const bridge = getRuntimeMqttBridge();
  let dispatched = false;

  if (bridge) {
    await bridge.publishDeviceCommand({
      deliveryId,
      runId: `sos-siren:${action}`,
      sceneId: `manual:${action}`,
      homeId: device.homeId,
      source: "manual",
      requestedAt: nowIso(),
      deviceId: device.deviceId,
      pid: device.pid,
      command,
      ...(payload ? { payload } : {})
    });
    dispatched = true;
  }

  await appendLog(device.deviceId, {
    level: "info",
    action,
    source: "PWA" as SosSirenLogSource,
    ...(userId ? { userId } : {})
  });

  return { deliveryId, dispatched };
}

export async function triggerAlarm(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseTriggerAlarmPayload(input);

  if (!parsed.ok) {
    throw new SosSirenModuleError(400, parsed.errors.join("; "));
  }

  const { deliveryId } = await dispatchCommand(
    device,
    "trigger_alarm",
    parsed.data,
    "triggerAlarm",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function stopAlarm(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { deliveryId } = await dispatchCommand(
    device,
    "stop_alarm",
    undefined,
    "stopAlarm",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function selectProfile(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseProfileIdPayload(input);

  if (!parsed.ok) {
    throw new SosSirenModuleError(400, parsed.errors.join("; "));
  }

  const { deliveryId } = await dispatchCommand(
    device,
    "apply_settings",
    { action: "select_profile", id: parsed.data.id },
    "selectProfile",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function testProfile(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseTestProfilePayload(input);

  if (!parsed.ok) {
    throw new SosSirenModuleError(400, parsed.errors.join("; "));
  }

  const { deliveryId } = await dispatchCommand(
    device,
    "alarm_test",
    { mode: "profile", ...parsed.data },
    "testProfile",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function testTone(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseTestTonePayload(input);

  if (!parsed.ok) {
    throw new SosSirenModuleError(400, parsed.errors.join("; "));
  }

  const { deliveryId } = await dispatchCommand(
    device,
    "alarm_test",
    { mode: "tone", ...parsed.data },
    "testTone",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function testSweep(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { deliveryId } = await dispatchCommand(
    device,
    "alarm_test",
    { mode: "sweep" },
    "testSweep",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function benchTest(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { deliveryId } = await dispatchCommand(
    device,
    "alarm_test",
    { mode: "bench" },
    "benchTest",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function setSpeakerProfile(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "setSpeakerProfile");
  const parsed = parseProfileIdPayload(input);

  if (!parsed.ok) {
    throw new SosSirenModuleError(400, parsed.errors.join("; "));
  }

  const { deliveryId } = await dispatchCommand(
    device,
    "apply_settings",
    { action: "speaker_profile", id: parsed.data.id },
    "setSpeakerProfile",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function rebootDevice(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { deliveryId } = await dispatchCommand(
    device,
    "restart",
    undefined,
    "rebootDevice",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function factoryReset(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ deliveryId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "factoryReset");
  const { deliveryId } = await dispatchCommand(
    device,
    "factory_reset",
    undefined,
    "factoryReset",
    resolvedContext.userId
  );
  return { deliveryId };
}

export async function listLogs(
  deviceId: string,
  context: DeviceRequestContext
): Promise<SosSirenLogRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return sosSirenLogRepository.listByDevice(device.deviceId);
}

/**
 * Canonical `status` ingestion — called from runtime.handlers.ts once the
 * firmware's MQTT client is actually implemented (currently a no-op stub).
 * Field names mirror WebServerService::buildStatusJson_ in the real
 * firmware's local REST API, the closest real spec available today.
 */
export async function ingestStatus(
  deviceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const device = await deviceRepository.get(normalizedDeviceId);
  const snapshot: Record<string, boolean | number | string> = {};

  for (const key of [
    "firmwareVersion",
    "sirenState",
    "uptimeSec",
    "remainingMs",
    "activeDutyPercent",
    "activeFrequencyHz",
    "elapsedOnMs",
    "coolingRemainingMs",
    "buttonPressed",
    "selectedProfileId",
    "selectedTone",
    "speakerProfile",
    "activeTone",
    "vtTriggerEnabled",
    "vtTriggerHigh",
    "vtTriggerSeen",
    "vtControlLatched",
    "sosPressCount",
    "commandActive",
    "testMode",
    "sosActive",
    "staConnected",
    "lastStopReason"
  ]) {
    const value = payload[key];

    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      snapshot[key] = value;
    }
  }

  await deviceUiRuntimeStore.saveTelemetry({
    deviceId: normalizedDeviceId,
    pid: device?.pid ?? sosSirenPid,
    occurredAt: nowIso(),
    telemetry: snapshot
  });
}

export const sosSirenTesting = {
  reset() {
    return sosSirenLogRepository.reset();
  }
};
