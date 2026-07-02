import type { TimestampedRecord } from "./platform";

export type OtaReleaseStatus = "draft" | "published" | "retired";

export type OtaReleaseChannel = "stable" | "beta";

export interface OtaReleaseRecord extends TimestampedRecord {
  releaseId: string;
  pid: string;
  hardwareRevision: string;
  version: string;
  channel: OtaReleaseChannel;
  artifactUrl: string;
  checksum: string;
  status: OtaReleaseStatus;
  createdBy: string;
  notes?: string;
  publishedAt?: string;
}

export interface OtaReleaseSummary {
  releaseId: string;
  pid: string;
  hardwareRevision: string;
  version: string;
  channel: OtaReleaseChannel;
  artifactUrl: string;
  checksum: string;
  status: OtaReleaseStatus;
  notes?: string;
  publishedAt?: string;
}

export type OtaResolutionStatus =
  | "update_available"
  | "up_to_date"
  | "no_match";

export interface OtaResolutionResult {
  deviceId: string;
  pid: string;
  hardwareRevision: string;
  channel: OtaReleaseChannel;
  status: OtaResolutionStatus;
  currentVersion?: string;
  release?: OtaReleaseSummary;
  reason?: string;
}

export interface DeviceFirmwarePlanResponse {
  deviceId: string;
  pid: string;
  hardwareRevision: string;
  currentVersion?: string;
  recommendedChannel: OtaReleaseChannel;
  stable: OtaResolutionResult;
  beta: OtaResolutionResult;
}
