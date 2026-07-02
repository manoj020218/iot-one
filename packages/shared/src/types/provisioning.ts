export type ProvisioningMethod = "ble" | "ap";

export type ProvisioningStatus =
  | "BLE_CONNECTED"
  | "WIFI_SENT"
  | "DEVICE_CONNECTING_WIFI"
  | "DEVICE_CONNECTING_CLOUD"
  | "MQTT_CONNECTED"
  | "DEVICE_REGISTERED"
  | "SUCCESS"
  | "FAILED";

export interface ProvisioningIntent {
  provisioningId: string;
  userId: string;
  homeId: string;
  method: ProvisioningMethod;
  status: ProvisioningStatus;
  deviceId?: string;
  pid?: string;
  createdAt: string;
  updatedAt: string;
}
