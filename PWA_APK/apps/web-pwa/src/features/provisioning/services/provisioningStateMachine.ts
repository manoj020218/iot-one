import type { ProvisioningMethod, ProvisioningStatus } from "@jenix/shared";

/**
 * Per PROVISIONING.md (repo root): BLE/AP provisioning's job ends once the
 * device confirms it joined Wi-Fi. MQTT/cloud connection happens on the
 * device's own afterward, independent of the phone -- so there is no
 * DEVICE_CONNECTING_CLOUD/MQTT_CONNECTED step here to honestly confirm.
 */
const bleSequence: ProvisioningStatus[] = [
  "BLE_CONNECTED",
  "WIFI_SENT",
  "DEVICE_CONNECTING_WIFI",
  "DEVICE_REGISTERED",
  "SUCCESS"
];

const apSequence: ProvisioningStatus[] = [
  "WIFI_SENT",
  "DEVICE_CONNECTING_WIFI",
  "DEVICE_REGISTERED",
  "SUCCESS"
];

export function getProvisioningSequence(
  method: ProvisioningMethod
): ProvisioningStatus[] {
  return method === "ble" ? bleSequence : apSequence;
}

export function getInitialProvisioningStatus(
  method: ProvisioningMethod
): ProvisioningStatus {
  return getProvisioningSequence(method)[0]!;
}
