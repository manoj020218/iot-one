import type { ProvisioningMethod, ProvisioningStatus } from "@jenix/shared";

export interface BleScanDevice {
  transportId: string;
  deviceId: string;
  pid: string;
  productName: string;
  iconText: string;
  rssi: number;
  provisioningReady: boolean;
}

export interface WifiCredentialPayload {
  ssid: string;
  password: string;
}

export interface ProvisioningProgressModel {
  method: ProvisioningMethod;
  statuses: ProvisioningStatus[];
  currentStatus: ProvisioningStatus;
}

export interface ProvisionedDeviceSummary {
  provisioningId: string;
  deviceId: string;
  pid: string;
  displayName: string;
  productName: string;
}
