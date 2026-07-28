import { randomUUID } from "node:crypto";

import type { DeviceRecord } from "@jenix/shared";

import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { deviceRepository } from "../devices/device.model";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import type { DeviceRequestContext } from "../devices/device.types";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";

import {
  tokenDispenserConnectionRepository,
  tokenDispenserLogRepository,
  tokenDispenserTemplateRepository
} from "./token-dispenser.model";
import type {
  TokenDispenserConnectionConfig,
  TokenDispenserLogRecord,
  TokenDispenserLogSource,
  TokenDispenserPrintTemplate
} from "./token-dispenser.types";
import {
  defaultTokenDispenserConnectionLabel,
  defaultTokenDispenserPrintTemplate,
  TokenDispenserModuleError
} from "./token-dispenser.types";
import {
  parsePrintTemplatePayload,
  parseSetCounterPayload,
  parseSetPrefixPayload
} from "./token-dispenser.validation";

export const tokenDispenserTopicPrefix = "jenix";
/** Wildcard subscriptions for the bridge's raw passthrough (tenantId/siteId vary
 *  per device, so this can't be a fixed legacyTopicRoots-style family root). */
export const tokenDispenserRawSubscriptions = ["telemetry", "state", "event"].map(
  (suffix) => [tokenDispenserTopicPrefix, "+", "+", "+", suffix].join("/")
);
const restrictedActions = new Set(["factory_reset"]);

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

export function buildTokenDispenserTopic(
  mqttTenantId: string,
  mqttSiteId: string,
  deviceId: string,
  suffix: "telemetry" | "state" | "command" | "event"
): string {
  return [tokenDispenserTopicPrefix, mqttTenantId, mqttSiteId, deviceId, suffix].join("/");
}

/** Firmware-local NVS labels used to build the device's real topic — see
 *  ConfigStore::net() in mqtt_client.cpp. Unrelated to the platform tenantId. */
async function resolveConnectionConfig(
  deviceId: string
): Promise<TokenDispenserConnectionConfig> {
  const existing = await tokenDispenserConnectionRepository.get(deviceId);
  return (
    existing ?? {
      deviceId,
      mqttTenantId: defaultTokenDispenserConnectionLabel,
      mqttSiteId: defaultTokenDispenserConnectionLabel
    }
  );
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
      throw new TokenDispenserModuleError(error.statusCode, error.message);
    }

    throw error;
  }

  const device = await deviceRepository.get(normalizeDeviceId(deviceId));

  if (!device) {
    throw new TokenDispenserModuleError(
      404,
      `Device not found: ${normalizeDeviceId(deviceId)}`
    );
  }

  if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
    throw new TokenDispenserModuleError(403, "Device access denied");
  }

  if (
    !resolvedContext.homeRole &&
    resolvedContext.userId &&
    device.ownerUserId !== resolvedContext.userId
  ) {
    throw new TokenDispenserModuleError(403, "Device access denied");
  }

  return { device, context: resolvedContext };
}

function requireOwnerOrAdmin(context: DeviceRequestContext, action: string) {
  if (
    restrictedActions.has(action) &&
    context.homeRole !== "owner" &&
    context.homeRole !== "admin"
  ) {
    throw new TokenDispenserModuleError(
      403,
      `Restricted action requires owner/admin access: ${action}`
    );
  }
}

function appendLog(
  deviceId: string,
  entry: Omit<TokenDispenserLogRecord, "logId" | "deviceId" | "timestamp">
): Promise<void> {
  return tokenDispenserLogRepository.append({
    logId: randomUUID(),
    deviceId,
    timestamp: nowIso(),
    ...entry
  });
}

async function dispatchCommand(
  device: DeviceRecord,
  command: string,
  extra: Record<string, unknown>,
  action: string,
  userId: string | undefined
): Promise<{ commandId: string; dispatched: boolean }> {
  const connection = await resolveConnectionConfig(device.deviceId);
  const topic = buildTokenDispenserTopic(
    connection.mqttTenantId,
    connection.mqttSiteId,
    device.deviceId,
    "command"
  );
  const commandId = randomUUID();
  const bridge = getRuntimeMqttBridge();
  let dispatched = false;

  if (bridge?.publishRaw) {
    await bridge.publishRaw(topic, { command, command_id: commandId, ...extra });
    dispatched = true;
  }

  await appendLog(device.deviceId, {
    level: "info",
    action,
    source: "PWA" as TokenDispenserLogSource,
    requestId: commandId,
    ...(userId ? { userId } : {})
  });

  return { commandId, dispatched };
}

export async function printNext(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { commandId } = await dispatchCommand(
    device,
    "PRINT_NEXT_TOKEN",
    {},
    "PRINT_NEXT_TOKEN",
    resolvedContext.userId
  );
  return { commandId };
}

export async function testPrint(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { commandId } = await dispatchCommand(
    device,
    "TEST_PRINT",
    {},
    "TEST_PRINT",
    resolvedContext.userId
  );
  return { commandId };
}

export async function resetRoll(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const { commandId } = await dispatchCommand(
    device,
    "RESET_ROLL_COUNTER",
    {},
    "RESET_ROLL_COUNTER",
    resolvedContext.userId
  );
  return { commandId };
}

export async function setCounter(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseSetCounterPayload(input);

  if (!parsed.ok) {
    throw new TokenDispenserModuleError(400, parsed.errors.join("; "));
  }

  const { commandId } = await dispatchCommand(
    device,
    "SET_TOKEN_COUNTER",
    { value: parsed.data.value },
    "SET_TOKEN_COUNTER",
    resolvedContext.userId
  );
  return { commandId };
}

export async function setPrefix(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parseSetPrefixPayload(input);

  if (!parsed.ok) {
    throw new TokenDispenserModuleError(400, parsed.errors.join("; "));
  }

  const { commandId } = await dispatchCommand(
    device,
    "SET_TOKEN_PREFIX",
    { prefix: parsed.data.prefix },
    "SET_TOKEN_PREFIX",
    resolvedContext.userId
  );
  return { commandId };
}

export async function factoryReset(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  requireOwnerOrAdmin(resolvedContext, "factory_reset");
  const { commandId } = await dispatchCommand(
    device,
    "FACTORY_RESET",
    {},
    "FACTORY_RESET",
    resolvedContext.userId
  );
  return { commandId };
}

export async function getTemplate(
  deviceId: string,
  context: DeviceRequestContext
): Promise<TokenDispenserPrintTemplate> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return (await tokenDispenserTemplateRepository.get(device.deviceId)) ?? {
    ...defaultTokenDispenserPrintTemplate
  };
}

export async function saveTemplate(
  deviceId: string,
  input: unknown,
  context: DeviceRequestContext
): Promise<{ commandId: string; template: TokenDispenserPrintTemplate }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);
  const parsed = parsePrintTemplatePayload(input);

  if (!parsed.ok) {
    throw new TokenDispenserModuleError(400, parsed.errors.join("; "));
  }

  await tokenDispenserTemplateRepository.save(device.deviceId, parsed.data);
  const { commandId } = await dispatchCommand(
    device,
    "SET_TEMPLATE",
    { template: parsed.data },
    "SET_TEMPLATE",
    resolvedContext.userId
  );

  return { commandId, template: parsed.data };
}

export async function listLogs(
  deviceId: string,
  context: DeviceRequestContext
): Promise<TokenDispenserLogRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return tokenDispenserLogRepository.listByDevice(device.deviceId);
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
    "currentToken",
    "lastPrintedToken",
    "printerState",
    "paperLow",
    "estimatedTokensLeft",
    "paperOut",
    "wifi_rssi",
    "uptime_sec",
    "firmware_version"
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

export async function ingestEvent(
  deviceId: string,
  event: Record<string, unknown>
): Promise<void> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  if (typeof event.command_id === "string") {
    await appendLog(normalizedDeviceId, {
      level: event.success === false ? "error" : "info",
      action: "ACK",
      source: "MQTT",
      requestId: event.command_id,
      ...(typeof event.reason === "string" ? { detail: event.reason } : {})
    });
    return;
  }

  if (typeof event.type === "string") {
    await appendLog(normalizedDeviceId, {
      level: "warn",
      action: event.type,
      source: "MQTT",
      detail: JSON.stringify(event)
    });
  }
}

export const tokenDispenserTesting = {
  reset() {
    return Promise.all([
      tokenDispenserTemplateRepository.reset(),
      tokenDispenserConnectionRepository.reset(),
      tokenDispenserLogRepository.reset()
    ]).then(() => undefined);
  }
};
