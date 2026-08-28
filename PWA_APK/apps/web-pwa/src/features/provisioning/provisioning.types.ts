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
  /**
   * Per-device Security Scheme 2 pairing secret, required for BLE
   * provisioning only (the AP flow doesn't use it). See
   * QRunlock/PROVISIONING.md Section 10 -- printed on every device boot as
   * "[PROVISIONING] Security2 username wifiprov PoP source=... value=...".
   */
  proofOfPossession?: string;
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
