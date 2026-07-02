import {
  createDeviceRecord,
  renameDeviceRecord,
  type DeviceRecord
} from "@jenix/shared";

import { getPid } from "../pid/pid.service";
import { evaluateScenesByTelemetry } from "../scenes/scene.service";
import { deviceRepository } from "./device.model";
import type {
  DevicePatchPayload,
  DeviceRequestContext,
  DeviceTelemetryIngestPayload,
  DeviceTelemetryIngestResponse,
  ParsedRegisterDevicePayload,
  RenameDevicePayload
} from "./device.types";
import { DeviceModuleError } from "./device.types";

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function requireDevice(deviceId: string): DeviceRecord {
  const record = deviceRepository.get(normalizeDeviceId(deviceId));

  if (!record) {
    throw new DeviceModuleError(404, `Device not found: ${normalizeDeviceId(deviceId)}`);
  }

  return record;
}

function ensureAccess(
  device: DeviceRecord,
  context: DeviceRequestContext
): DeviceRecord {
  if (context.userId && device.ownerUserId !== context.userId) {
    throw new DeviceModuleError(403, "Device access denied");
  }

  return device;
}

export function listDevices(context: DeviceRequestContext): DeviceRecord[] {
  return deviceRepository.list().filter((device) => {
    if (context.userId && device.ownerUserId !== context.userId) {
      return false;
    }

    if (context.homeId && device.homeId !== context.homeId) {
      return false;
    }

    return true;
  });
}

export function getDevice(
  deviceId: string,
  context: DeviceRequestContext
): DeviceRecord {
  return ensureAccess(requireDevice(deviceId), context);
}

export function registerDevice(
  payload: ParsedRegisterDevicePayload
): DeviceRecord {
  const normalizedDeviceId = normalizeDeviceId(payload.deviceId);

  if (deviceRepository.get(normalizedDeviceId)) {
    throw new DeviceModuleError(409, `Device already exists: ${normalizedDeviceId}`);
  }

  let pidRecord;
  try {
    pidRecord = getPid(payload.pid);
  } catch {
    throw new DeviceModuleError(404, `PID not found: ${payload.pid.trim().toUpperCase()}`);
  }

  const record = createDeviceRecord({
    ...payload,
    deviceId: normalizedDeviceId,
    pid: pidRecord.pid,
    displayName: payload.displayName || pidRecord.productName
  });

  return deviceRepository.save(record);
}

export function patchDevice(
  deviceId: string,
  patch: DevicePatchPayload,
  context: DeviceRequestContext
): DeviceRecord {
  const existing = ensureAccess(requireDevice(deviceId), context);
  const updated: DeviceRecord = {
    ...existing,
    updatedAt: new Date().toISOString()
  };

  if (patch.displayName !== undefined) {
    updated.displayName = patch.displayName;
  }

  if (patch.mqttStatus !== undefined) {
    updated.mqttStatus = patch.mqttStatus;
  }

  if (patch.cloudStatus !== undefined) {
    updated.cloudStatus = patch.cloudStatus;
  }

  if (patch.localStatus !== undefined) {
    updated.localStatus = patch.localStatus;
  }

  if (patch.lastSeenAt !== undefined) {
    updated.lastSeenAt = patch.lastSeenAt;
  }

  return deviceRepository.save(updated);
}

export function renameDevice(
  deviceId: string,
  payload: RenameDevicePayload,
  context: DeviceRequestContext
): DeviceRecord {
  const existing = ensureAccess(requireDevice(deviceId), context);
  return deviceRepository.save(renameDeviceRecord(existing, payload.displayName));
}

export async function ingestDeviceTelemetry(
  deviceId: string,
  payload: DeviceTelemetryIngestPayload
): Promise<DeviceTelemetryIngestResponse> {
  const existing = requireDevice(deviceId);
  const occurredAt = payload.occurredAt ?? new Date().toISOString();
  const updatedDevice: DeviceRecord = {
    ...existing,
    updatedAt: occurredAt,
    lastSeenAt: occurredAt,
    ...(payload.mqttStatus ? { mqttStatus: payload.mqttStatus } : {}),
    ...(payload.cloudStatus ? { cloudStatus: payload.cloudStatus } : {}),
    ...(payload.localStatus ? { localStatus: payload.localStatus } : {})
  };
  const savedDevice = deviceRepository.save(updatedDevice);
  const sceneRuntime = await evaluateScenesByTelemetry(
    {
      deviceId: savedDevice.deviceId,
      telemetry: payload.telemetry,
      occurredAt
    },
    {
      homeId: savedDevice.homeId
    }
  );

  return {
    device: savedDevice,
    sceneRuntime
  };
}

export const deviceTesting = {
  reset() {
    deviceRepository.reset();
  }
};
