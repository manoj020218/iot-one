import type { ParsedRegisterDevicePayload } from "./device.types";
import type {
  DevicePatchPayload,
  RenameDevicePayload
} from "./device.types";

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

  if (
    body.mqttStatus === "online" ||
    body.mqttStatus === "offline" ||
    body.mqttStatus === "unknown"
  ) {
    patch.mqttStatus = body.mqttStatus;
  }

  if (
    body.cloudStatus === "online" ||
    body.cloudStatus === "offline" ||
    body.cloudStatus === "unknown"
  ) {
    patch.cloudStatus = body.cloudStatus;
  }

  if (
    body.localStatus === "available" ||
    body.localStatus === "unavailable" ||
    body.localStatus === "unknown"
  ) {
    patch.localStatus = body.localStatus;
  }

  if (typeof body.lastSeenAt === "string" && body.lastSeenAt.trim()) {
    patch.lastSeenAt = body.lastSeenAt.trim();
  }

  return Object.keys(patch).length ? patch : null;
}
