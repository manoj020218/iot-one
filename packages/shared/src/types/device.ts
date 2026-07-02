export type DeviceConnectivityStatus = "online" | "offline" | "unknown";

export type DeviceLocalStatus = "available" | "unavailable" | "unknown";

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
