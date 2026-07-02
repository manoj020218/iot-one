import type { DeviceRecord, RegisterDeviceInput } from "@jenix/shared";

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
