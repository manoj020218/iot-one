import type {
  DeviceUiCommandAckRecord,
  DeviceUiCommandRequest,
  DeviceUiRuntimeState,
  DeviceFirmwareRequestInput,
  DeviceFirmwarePlanResponse,
  DeviceFirmwareRequestResult,
  DeviceFirmwareRolloutRecord,
  DeviceRecord,
  HomeAccessRole,
  RegisterDeviceInput,
  SceneTelemetrySnapshot
} from "@jenix/shared";

import type { SceneRuntimeQueueResponse } from "../scenes/scene.types";

export interface DeviceRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface RenameDevicePayload {
  displayName: string;
}

export interface DevicePatchPayload {
  displayName?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  matterEnabled?: boolean;
  mqttStatus?: DeviceRecord["mqttStatus"];
  cloudStatus?: DeviceRecord["cloudStatus"];
  localStatus?: DeviceRecord["localStatus"];
  lastSeenAt?: string;
}

export type DeviceFirmwareRequestPayload = DeviceFirmwareRequestInput;

export interface DeviceTelemetryIngestPayload {
  telemetry: SceneTelemetrySnapshot;
  occurredAt?: string;
  mqttStatus?: DeviceRecord["mqttStatus"];
  cloudStatus?: DeviceRecord["cloudStatus"];
  localStatus?: DeviceRecord["localStatus"];
}

export interface DeviceTelemetryIngestResponse {
  device: DeviceRecord;
  sceneRuntimeQueue: SceneRuntimeQueueResponse;
}

export type DeviceFirmwareRequestResponse = DeviceFirmwareRequestResult;
export type DeviceFirmwarePlanResult = DeviceFirmwarePlanResponse;
export type DeviceFirmwareRolloutResult = DeviceFirmwareRolloutRecord;
export type DeviceUiRuntimeResult = DeviceUiRuntimeState;
export type DeviceUiCommandPayload = DeviceUiCommandRequest;
export type DeviceUiCommandResult = DeviceUiCommandAckRecord;

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
