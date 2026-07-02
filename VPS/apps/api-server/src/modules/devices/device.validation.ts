import type {
  DevicePatchPayload,
  DeviceTelemetryIngestPayload,
  ParsedRegisterDevicePayload,
  RenameDevicePayload
} from "./device.types";
import type { ScenePrimitiveValue } from "@jenix/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value
  } as Record<K, V>;
}

function parseConnectivityStatus(
  value: unknown
): DevicePatchPayload["mqttStatus"] | undefined {
  return value === "online" || value === "offline" || value === "unknown"
    ? value
    : undefined;
}

function parseLocalStatus(
  value: unknown
): DevicePatchPayload["localStatus"] | undefined {
  return value === "available" ||
    value === "unavailable" ||
    value === "unknown"
    ? value
    : undefined;
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const occurredAt = value.trim();
  return Number.isNaN(Date.parse(occurredAt)) ? undefined : occurredAt;
}

function parsePrimitiveValue(value: unknown): ScenePrimitiveValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

function parseTelemetrySnapshot(
  value: unknown
): Record<string, ScenePrimitiveValue> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.entries(value).reduce<Record<string, ScenePrimitiveValue>>(
    (snapshot, [key, entryValue]) => {
      const primitiveValue = parsePrimitiveValue(entryValue);

      if (primitiveValue !== undefined) {
        snapshot[key] = primitiveValue;
      }

      return snapshot;
    },
    {}
  );
}

export function parseRegisterDevicePayload(
  body: unknown
): ParsedRegisterDevicePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const deviceId = readTrimmedString(body, "deviceId");
  const pid = readTrimmedString(body, "pid");
  const homeId = readTrimmedString(body, "homeId");
  const ownerUserId = readTrimmedString(body, "ownerUserId");

  if (!deviceId || !pid || !homeId || !ownerUserId) {
    return null;
  }

  const displayName = readTrimmedString(body, "displayName");
  const firmwareVersion = readTrimmedString(body, "firmwareVersion");
  const hardwareRevision = readTrimmedString(body, "hardwareRevision");
  const matterEnabled =
    typeof body.matterEnabled === "boolean" ? body.matterEnabled : undefined;

  return {
    deviceId,
    pid,
    homeId,
    ownerUserId,
    ...optionalProp("displayName", displayName),
    ...optionalProp("firmwareVersion", firmwareVersion),
    ...optionalProp("hardwareRevision", hardwareRevision),
    ...optionalProp("matterEnabled", matterEnabled)
  };
}

export function parseRenamePayload(body: unknown): RenameDevicePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const displayName = readTrimmedString(body, "displayName");

  if (!displayName) {
    return null;
  }

  return {
    displayName
  };
}

export function parseDevicePatchPayload(body: unknown): DevicePatchPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const patch: DevicePatchPayload = {};

  const displayName = readTrimmedString(body, "displayName");
  if (displayName) {
    patch.displayName = displayName;
  }

  const mqttStatus = parseConnectivityStatus(body.mqttStatus);
  if (mqttStatus) {
    patch.mqttStatus = mqttStatus;
  }

  const cloudStatus = parseConnectivityStatus(body.cloudStatus);
  if (cloudStatus) {
    patch.cloudStatus = cloudStatus;
  }

  const localStatus = parseLocalStatus(body.localStatus);
  if (localStatus) {
    patch.localStatus = localStatus;
  }

  if (typeof body.lastSeenAt === "string" && body.lastSeenAt.trim()) {
    patch.lastSeenAt = body.lastSeenAt.trim();
  }

  return Object.keys(patch).length ? patch : null;
}

export function parseDeviceTelemetryPayload(
  body: unknown
): DeviceTelemetryIngestPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const telemetry = parseTelemetrySnapshot(body.telemetry);

  if (!telemetry) {
    return null;
  }

  return {
    telemetry,
    ...optionalProp("occurredAt", parseIsoTimestamp(body.occurredAt)),
    ...optionalProp("mqttStatus", parseConnectivityStatus(body.mqttStatus)),
    ...optionalProp("cloudStatus", parseConnectivityStatus(body.cloudStatus)),
    ...optionalProp("localStatus", parseLocalStatus(body.localStatus))
  };
}
