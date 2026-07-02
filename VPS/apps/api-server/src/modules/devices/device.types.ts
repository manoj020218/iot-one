import type {
  DeviceRecord,
  RegisterDeviceInput,
  SceneTelemetrySnapshot
} from "@jenix/shared";

import type { SceneRuntimeBatchResponse } from "../scenes/scene.types";

export interface DeviceRequestContext {
  userId?: string;
  homeId?: string;
}

export interface RenameDevicePayload {
  displayName: string;
}

export interface DevicePatchPayload {
  displayName?: string;
  mqttStatus?: DeviceRecord["mqttStatus"];
  cloudStatus?: DeviceRecord["cloudStatus"];
  localStatus?: DeviceRecord["localStatus"];
  lastSeenAt?: string;
}

export interface DeviceTelemetryIngestPayload {
  telemetry: SceneTelemetrySnapshot;
  occurredAt?: string;
  mqttStatus?: DeviceRecord["mqttStatus"];
  cloudStatus?: DeviceRecord["cloudStatus"];
  localStatus?: DeviceRecord["localStatus"];
}

export interface DeviceTelemetryIngestResponse {
  device: DeviceRecord;
  sceneRuntime: SceneRuntimeBatchResponse;
}

export class DeviceModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "DeviceModuleError";
  }
}

export type ParsedRegisterDevicePayload = RegisterDeviceInput;
