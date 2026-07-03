import {
  createDeviceRecord,
  renameDeviceRecord,
  type DeviceRecord
} from "@jenix/shared";

import { getDeviceFirmwarePlan as resolveDeviceFirmwarePlan, resolveOtaReleaseForDevice } from "../ota/ota.service";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";
import { getPid } from "../pid/pid.service";
import { evaluateScenesByTelemetry } from "../scenes/scene.service";
import { deviceRepository } from "./device.model";
import type {
  DeviceFirmwarePlanResult,
  DevicePatchPayload,
  DeviceFirmwareRequestPayload,
  DeviceFirmwareRequestResponse,
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

async function resolveContext(
  context: DeviceRequestContext
): Promise<DeviceRequestContext> {
  try {
    return await resolveHomeAccessContext(context);
  } catch (error) {
    if (error instanceof HomeModuleError) {
      throw new DeviceModuleError(error.statusCode, error.message);
    }

    throw error;
  }
}

async function requireDevice(deviceId: string): Promise<DeviceRecord> {
  const record = await deviceRepository.get(normalizeDeviceId(deviceId));

  if (!record) {
    throw new DeviceModuleError(404, `Device not found: ${normalizeDeviceId(deviceId)}`);
  }

  return record;
}

function ensureAccess(
  device: DeviceRecord,
  context: DeviceRequestContext
): DeviceRecord {
  if (context.homeId && device.homeId !== context.homeId) {
    throw new DeviceModuleError(403, "Device access denied");
  }

  if (!context.homeRole && context.userId && device.ownerUserId !== context.userId) {
    throw new DeviceModuleError(403, "Device access denied");
  }

  return device;
}

export async function listDevices(
  context: DeviceRequestContext
): Promise<DeviceRecord[]> {
  const resolvedContext = await resolveContext(context);

  return (await deviceRepository.list()).filter((device) => {
    if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
      return false;
    }

    if (
      !resolvedContext.homeRole &&
      resolvedContext.userId &&
      device.ownerUserId !== resolvedContext.userId
    ) {
      return false;
    }

    return true;
  });
}

export function getDevice(
  deviceId: string,
  context: DeviceRequestContext
): Promise<DeviceRecord> {
  return resolveContext(context).then((resolvedContext) =>
    requireDevice(deviceId).then((device) => ensureAccess(device, resolvedContext))
  );
}

export async function registerDevice(
  payload: ParsedRegisterDevicePayload
): Promise<DeviceRecord> {
  const normalizedDeviceId = normalizeDeviceId(payload.deviceId);

  if (await deviceRepository.get(normalizedDeviceId)) {
    throw new DeviceModuleError(409, `Device already exists: ${normalizedDeviceId}`);
  }

  let pidRecord;
  try {
    pidRecord = await getPid(payload.pid);
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

export async function patchDevice(
  deviceId: string,
  patch: DevicePatchPayload,
  context: DeviceRequestContext
): Promise<DeviceRecord> {
  const resolvedContext = await resolveContext(context);

  if (resolvedContext.homeRole === "viewer") {
    throw new DeviceModuleError(403, "Viewer access cannot modify devices");
  }

  const existing = ensureAccess(await requireDevice(deviceId), resolvedContext);
  const updated: DeviceRecord = {
    ...existing,
    updatedAt: new Date().toISOString()
  };

  if (patch.displayName !== undefined) {
    updated.displayName = patch.displayName;
  }

  if (patch.firmwareVersion !== undefined) {
    updated.firmwareVersion = patch.firmwareVersion;
  }

  if (patch.hardwareRevision !== undefined) {
    updated.hardwareRevision = patch.hardwareRevision;
  }

  if (patch.matterEnabled !== undefined) {
    updated.matterEnabled = patch.matterEnabled;
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

export async function getDeviceFirmwarePlan(
  deviceId: string,
  context: DeviceRequestContext
): Promise<DeviceFirmwarePlanResult> {
  const existing = ensureAccess(
    await requireDevice(deviceId),
    await resolveContext(context)
  );
  return resolveDeviceFirmwarePlan(existing);
}

export async function requestDeviceFirmwareUpdate(
  deviceId: string,
  payload: DeviceFirmwareRequestPayload,
  context: DeviceRequestContext
): Promise<DeviceFirmwareRequestResponse> {
  const resolvedContext = await resolveContext(context);

  if (resolvedContext.homeRole === "viewer") {
    throw new DeviceModuleError(403, "Viewer access cannot request firmware updates");
  }

  const existing = ensureAccess(await requireDevice(deviceId), resolvedContext);
  const channel = payload.channel ?? "stable";
  const resolution = await resolveOtaReleaseForDevice(
    existing,
    channel,
    payload.targetVersion
  );

  if (!resolution.release) {
    throw new DeviceModuleError(
      409,
      resolution.reason ?? `No ${channel} firmware release is available`
    );
  }

  const requestedAt = new Date().toISOString();

  return {
    deviceId: existing.deviceId,
    pid: existing.pid,
    channel,
    targetVersion: resolution.release.version,
    ...(existing.firmwareVersion ? { currentVersion: existing.firmwareVersion } : {}),
    status:
      existing.firmwareVersion === resolution.release.version ? "up_to_date" : "queued",
    requestedAt
  };
}

export async function renameDevice(
  deviceId: string,
  payload: RenameDevicePayload,
  context: DeviceRequestContext
): Promise<DeviceRecord> {
  const resolvedContext = await resolveContext(context);

  if (resolvedContext.homeRole === "viewer") {
    throw new DeviceModuleError(403, "Viewer access cannot rename devices");
  }

  const existing = ensureAccess(await requireDevice(deviceId), resolvedContext);
  return deviceRepository.save(renameDeviceRecord(existing, payload.displayName));
}

export async function ingestDeviceTelemetry(
  deviceId: string,
  payload: DeviceTelemetryIngestPayload
): Promise<DeviceTelemetryIngestResponse> {
  const existing = await requireDevice(deviceId);
  const occurredAt = payload.occurredAt ?? new Date().toISOString();
  const updatedDevice: DeviceRecord = {
    ...existing,
    updatedAt: occurredAt,
    lastSeenAt: occurredAt,
    ...(payload.mqttStatus ? { mqttStatus: payload.mqttStatus } : {}),
    ...(payload.cloudStatus ? { cloudStatus: payload.cloudStatus } : {}),
    ...(payload.localStatus ? { localStatus: payload.localStatus } : {})
  };
  const savedDevice = await deviceRepository.save(updatedDevice);
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
    return deviceRepository.reset();
  }
};
