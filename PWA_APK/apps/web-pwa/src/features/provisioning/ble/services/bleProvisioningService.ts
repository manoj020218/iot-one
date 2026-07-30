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
import { getBlePlugin } from "./bleDiscoveryService";
import {
  connectToDevice,
  disconnectFromDevice,
  isHelloResponse,
  isSetWifiResponse,
  sendJsonCommand
} from "./bleProtocol";

export interface ProvisionBleDeviceInput {
  session: AuthSession;
  device: BleScanDevice;
  wifi: WifiCredentialPayload;
  onStatusChange?: (status: ProvisioningStatus) => void;
}

/**
 * Runs the real BLE credential exchange against a connected device, per
 * PROVISIONING.md (repo root): hello -> set_wifi -> confirm the device
 * joined Wi-Fi, then disconnect. That is the full scope of BLE provisioning
 * -- MQTT/cloud connection happens on the device's own afterward, over its
 * new Wi-Fi link, independent of the phone. This code has no business
 * waiting around for that.
 */
async function runBleHandshake(
  device: BleScanDevice,
  wifi: WifiCredentialPayload,
  onStatusChange?: (status: ProvisioningStatus) => void
) {
  const ble = getBlePlugin();

  if (!ble) {
    throw new Error(
      "Bluetooth is only available inside the Jenix One app, not in a browser."
    );
  }

  await connectToDevice(ble, device.transportId);

  try {
    await sendJsonCommand(ble, device.transportId, { cmd: "hello" }, {
      timeoutMs: 6000,
      validate: isHelloResponse
    });

    const setWifiResult = await sendJsonCommand(
      ble,
      device.transportId,
      { cmd: "set_wifi", ssid: wifi.ssid, password: wifi.password },
      { timeoutMs: 25000, validate: isSetWifiResponse }
    );

    onStatusChange?.("WIFI_SENT");

    if (!setWifiResult.wifi_connected) {
      throw new Error(
        "The device could not join that Wi-Fi network. Check the password and try again."
      );
    }

    onStatusChange?.("DEVICE_CONNECTING_WIFI");
  } finally {
    await disconnectFromDevice(ble, device.transportId);
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
