import type { AuthSession, ProvisioningStatus } from "@jenix/shared";

import type {
  ProvisionedDeviceSummary,
  WifiCredentialPayload
} from "../../provisioning.types";
import {
  completeProvisioningIntent,
  registerProvisionedDevice,
  registerProvisioningIntent
} from "../../services/provisioningApi";
import type { BleScanDevice } from "../../provisioning.types";
import { getEspProvisioningPlugin } from "./espProvisioningPlugin";

export interface ProvisionBleDeviceInput {
  session: AuthSession;
  device: BleScanDevice;
  wifi: WifiCredentialPayload;
  onStatusChange?: (status: ProvisioningStatus) => void;
}

/**
 * Espressif's own default provisioning service UUID and Security Scheme 2
 * username -- confirmed against QRunlock's real prov2 firmware
 * (BleProvisioningService.cpp: kProvisioningServiceUuid,
 * config::kProvisioningSec2Username), and shared by every device that uses
 * the stock esp-idf `wifi_provisioning` component unmodified.
 */
const ESP_PROVISIONING_SERVICE_UUID = "0000ffff-0000-1000-8000-00805f9b34fb";
const ESP_PROVISIONING_USERNAME = "wifiprov";

/**
 * Runs the real Espressif protocomm + Security Scheme 2 (SRP6a) BLE
 * handshake against a connected device, via EspProvisioningPlugin.java
 * (native Android, wrapping Espressif's esp-idf-provisioning-android SDK).
 * See QRunlock/PROVISIONING.md Section 10. MQTT/cloud connection happens on
 * the device's own afterward, over its new Wi-Fi link, independent of the
 * phone -- this code has no business waiting around for that.
 */
async function runBleHandshake(
  device: BleScanDevice,
  wifi: WifiCredentialPayload,
  onStatusChange?: (status: ProvisioningStatus) => void
) {
  const esp = getEspProvisioningPlugin();

  if (!esp) {
    throw new Error(
      "Bluetooth is only available inside the Jenix One app, not in a browser."
    );
  }

  if (!wifi.proofOfPossession) {
    throw new Error(
      "This device's pairing code is required to provision it over BLE."
    );
  }

  await esp.connect({
    macAddress: device.transportId,
    serviceUuid: ESP_PROVISIONING_SERVICE_UUID
  });

  try {
    const progressListener = await esp.addListener(
      "provisioningProgress",
      ({ stage }) => {
        if (stage === "wifiConfigSent") {
          onStatusChange?.("WIFI_SENT");
        } else if (stage === "wifiConfigApplied") {
          onStatusChange?.("DEVICE_CONNECTING_WIFI");
        }
      }
    );

    try {
      await esp.provision({
        username: ESP_PROVISIONING_USERNAME,
        pop: wifi.proofOfPossession,
        ssid: wifi.ssid,
        passphrase: wifi.password
      });
    } finally {
      await progressListener.remove();
    }
  } finally {
    await esp.disconnect();
  }
}

export async function provisionBleDevice({
  session,
  device,
  wifi,
  onStatusChange
}: ProvisionBleDeviceInput): Promise<ProvisionedDeviceSummary> {
  const normalizedSsid = wifi.ssid.trim();
  const normalizedPassword = wifi.password.trim();

  if (!normalizedSsid || !normalizedPassword) {
    throw new Error("Wi-Fi credentials are required for BLE provisioning.");
  }

  const intent = await registerProvisioningIntent(session, {
    method: "ble",
    pid: device.pid
  });

  await runBleHandshake(
    device,
    { ssid: normalizedSsid, password: normalizedPassword },
    onStatusChange
  );

  const record = await registerProvisionedDevice(session, {
    deviceId: device.deviceId,
    pid: device.pid,
    displayName: device.productName,
    firmwareVersion: "0.9.0",
    hardwareRevision: "HW1.0",
    matterEnabled: false
  });

  onStatusChange?.("DEVICE_REGISTERED");

  await completeProvisioningIntent(session, intent.provisioningId, {
    deviceId: record.deviceId,
    pid: record.pid,
    status: "SUCCESS"
  });

  onStatusChange?.("SUCCESS");

  return {
    provisioningId: intent.provisioningId,
    deviceId: record.deviceId,
    pid: record.pid,
    displayName: record.displayName,
    productName: device.productName
  };
}
