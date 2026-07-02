import type { ProvisioningMethod, ProvisioningStatus } from "@jenix/shared";

const bleSequence: ProvisioningStatus[] = [
  "BLE_CONNECTED",
  "WIFI_SENT",
  "DEVICE_CONNECTING_WIFI",
  "DEVICE_CONNECTING_CLOUD",
  "MQTT_CONNECTED",
  "DEVICE_REGISTERED",
  "SUCCESS"
];

const apSequence: ProvisioningStatus[] = [
  "WIFI_SENT",
  "DEVICE_CONNECTING_WIFI",
  "DEVICE_CONNECTING_CLOUD",
  "MQTT_CONNECTED",
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
