export type DeviceConnectivityStatus = "online" | "offline" | "unknown";

export type DeviceLocalStatus = "available" | "unavailable" | "unknown";

export type DeviceFirmwareChannel = "stable" | "beta";

export type DeviceFirmwareRequestStatus = "queued" | "up_to_date";
export type DeviceFirmwareRolloutStatus =
  | "queued"
  | "processing"
  | "dispatched"
  | "completed"
  | "failed";
export type DeviceFirmwareDeliveryState = Exclude<
  DeviceFirmwareRolloutStatus,
  "processing"
>;

export interface DeviceRecord {
  deviceId: string;
  pid: string;
  homeId: string;
  ownerUserId: string;
  displayName: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  matterEnabled?: boolean;
  mqttStatus: DeviceConnectivityStatus;
  cloudStatus: DeviceConnectivityStatus;
  localStatus?: DeviceLocalStatus;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDeviceInput {
  deviceId: string;
  pid: string;
  homeId: string;
  ownerUserId: string;
  displayName?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  matterEnabled?: boolean;
}

export interface DeviceFirmwareRequestInput {
  channel?: DeviceFirmwareChannel;
  targetVersion?: string;
}

export interface DeviceFirmwareRequestResult {
  deviceId: string;
  pid: string;
  channel: DeviceFirmwareChannel;
  targetVersion: string;
  currentVersion?: string;
  status: DeviceFirmwareRequestStatus;
  requestedAt: string;
  requestId?: string;
  deliveryState?: DeviceFirmwareDeliveryState;
}

export interface DeviceFirmwareRolloutRecord {
  requestId: string;
  deviceId: string;
  homeId: string;
  pid: string;
  channel: DeviceFirmwareChannel;
  targetVersion: string;
  artifactUrl: string;
  checksum: string;
  requestedAt: string;
  requestedBy: string;
  currentVersion?: string;
  attemptCount: number;
  status: DeviceFirmwareRolloutStatus;
  processingWorkerId?: string;
  processingStartedAt?: string;
  visibleAfter?: string;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  replayedFromRequestId?: string;
}
