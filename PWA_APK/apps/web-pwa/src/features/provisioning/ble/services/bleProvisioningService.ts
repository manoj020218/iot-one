import type { AuthSession, ProvisioningStatus } from "@jenix/shared";

import type {
  ProvisionedDeviceSummary,
  WifiCredentialPayload
} from "../../provisioning.types";
import { getProvisioningSequence } from "../../services/provisioningStateMachine";
import {
  completeProvisioningIntent,
  registerProvisionedDevice,
  registerProvisioningIntent
} from "../../services/provisioningApi";
import type { BleScanDevice } from "../../provisioning.types";

export interface ProvisionBleDeviceInput {
  session: AuthSession;
  device: BleScanDevice;
  wifi: WifiCredentialPayload;
  onStatusChange?: (status: ProvisioningStatus) => void;
}

function waitForNextStep() {
  return Promise.resolve();
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
  const progression = getProvisioningSequence("ble");

  for (const status of progression.slice(1, 5)) {
    await waitForNextStep();
    onStatusChange?.(status);
  }

  const record = await registerProvisionedDevice(session, {
    deviceId: device.deviceId,
    pid: device.pid,
    displayName: device.productName,
    firmwareVersion: "0.9.0",
    hardwareRevision: "HW1.0",
    matterEnabled: false
  });

  await waitForNextStep();
  onStatusChange?.("DEVICE_REGISTERED");

  await completeProvisioningIntent(intent.provisioningId, {
    deviceId: record.deviceId,
    pid: record.pid,
    status: "SUCCESS"
  });

  await waitForNextStep();
  onStatusChange?.("SUCCESS");

  return {
    provisioningId: intent.provisioningId,
    deviceId: record.deviceId,
    pid: record.pid,
    displayName: record.displayName,
    productName: device.productName
  };
}
