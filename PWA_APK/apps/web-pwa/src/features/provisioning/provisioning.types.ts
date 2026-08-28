import type { ProvisioningMethod, ProvisioningStatus } from "@jenix/shared";

export interface BleScanDevice {
  transportId: string;
  deviceId: string;
  pid: string;
  productName: string;
  iconText: string;
  rssi: number;
  provisioningReady: boolean;
  /**
   * The device's actually-advertised primary GATT service UUID, captured
   * live from the scan result -- Espressif's protocomm_ble scheme
   * randomizes this per boot session rather than using the fixed constant
   * from firmware source (BleProvisioningService.cpp's
   * kProvisioningServiceUuid), so it can't be hardcoded. Required by
   * EspProvisioning's connect() to find the right GATT service. Undefined
   * for devices that didn't advertise any service UUID (can't be BLE
   * Security2-provisioned).
   */
  serviceUuid?: string;
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
