import type { DeviceFirmwarePlanResponse, DeviceRecord, OtaReleaseRecord } from "@jenix/shared";

export interface OtaActorContext {
  actorId: string;
  role: "JENIX_DEVELOPER" | "JENIX_SUPER_ADMIN";
}

export interface CreateOtaReleaseInput {
  releaseId: string;
  pid: string;
  hardwareRevision: string;
  version: string;
  channel: OtaReleaseRecord["channel"];
  artifactUrl: string;
  checksum: string;
  status?: OtaReleaseRecord["status"];
  notes?: string;
}

export interface OtaModuleState {
  releases: OtaReleaseRecord[];
}

export class OtaModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "OtaModuleError";
  }
}

export type ParsedOtaReleasePayload = CreateOtaReleaseInput;

export interface DeviceFirmwarePlanResult extends DeviceFirmwarePlanResponse {
  device: DeviceRecord;
}

export interface OtaDeliveryRequestInput {
  channel: OtaReleaseRecord["channel"];
  targetVersion?: string;
  requestedAt: string;
  requestedBy: string;
}

export interface OtaDeliveryRequest {
  requestId: string;
  deviceId: string;
  homeId: string;
  pid: string;
  channel: OtaReleaseRecord["channel"];
  targetVersion: string;
  artifactUrl: string;
  checksum: string;
  requestedAt: string;
  requestedBy: string;
  currentVersion?: string;
}
