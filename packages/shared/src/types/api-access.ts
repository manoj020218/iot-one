import type { TimestampedRecord } from "./platform";

export type ApiPackageStatus = "draft" | "active" | "retired";

export type ApiKeyStatus = "active" | "revoked";

export interface ApiPackageRecord extends TimestampedRecord {
  packageId: string;
  pid: string;
  name: string;
  status: ApiPackageStatus;
  scopes: string[];
  createdBy: string;
  docsUrl?: string;
  rateLimitPerMinute?: number;
}

export interface ApiKeyRecord extends TimestampedRecord {
  keyId: string;
  packageId: string;
  pid: string;
  homeId: string;
  label: string;
  scopes: string[];
  status: ApiKeyStatus;
  createdByUserId: string;
  maskedKey: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface ApiKeyCreateResult extends ApiKeyRecord {
  secret: string;
}

export interface PublicDeviceState {
  deviceId: string;
  displayName: string;
  pid: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  mqttStatus: "online" | "offline" | "unknown";
  cloudStatus: "online" | "offline" | "unknown";
  localStatus?: "available" | "unavailable" | "unknown";
  lastSeenAt?: string;
}

export interface PublicDeviceCommandResult {
  deviceId: string;
  accepted: boolean;
  command: string;
  occurredAt: string;
}
