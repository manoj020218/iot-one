import type { DeviceRecord, RegisterDeviceInput } from "../types/device";

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

export function createDeviceRecord(
  input: RegisterDeviceInput,
  now = new Date()
): DeviceRecord {
  const timestamp = now.toISOString();

  return {
    deviceId: input.deviceId.trim().toUpperCase(),
    pid: input.pid.trim().toUpperCase(),
    homeId: input.homeId,
    ownerUserId: input.ownerUserId,
    displayName: input.displayName?.trim() || input.deviceId.trim().toUpperCase(),
    mqttStatus: "unknown",
    cloudStatus: "unknown",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...optionalProp("firmwareVersion", input.firmwareVersion?.trim()),
    ...optionalProp("hardwareRevision", input.hardwareRevision?.trim()),
    ...optionalProp("matterEnabled", input.matterEnabled)
  };
}

export function renameDeviceRecord(
  device: DeviceRecord,
  displayName: string,
  now = new Date()
): DeviceRecord {
  return {
    ...device,
    displayName: displayName.trim(),
    updatedAt: now.toISOString()
  };
}
