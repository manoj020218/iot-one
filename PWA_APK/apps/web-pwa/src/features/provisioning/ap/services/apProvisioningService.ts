import { foundationPidBlueprint } from "@jenix/device-schemas";
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

export interface ApSetupDescriptor {
  apSsid: string;
  pid: string;
  productName: string;
}

export interface ProvisionApDeviceInput {
  session: AuthSession;
  wifi: WifiCredentialPayload;
  onStatusChange?: (status: ProvisioningStatus) => void;
}

const apSetupDescriptor: ApSetupDescriptor = {
  apSsid: "JENIX-SETUP-TG-C3",
  pid: foundationPidBlueprint.pid,
  productName: foundationPidBlueprint.productName
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function waitForNextStep() {
  return Promise.resolve();
}

function createApDeviceId() {
  return `JNX-TG-C3-${Date.now().toString(36).slice(-4)}${Math.random()
    .toString(36)
    .slice(2, 4)}`.toUpperCase();
}

export function getApSetupDescriptor(): ApSetupDescriptor {
  return clone(apSetupDescriptor);
}

export async function provisionApDevice({
  session,
  wifi,
  onStatusChange
}: ProvisionApDeviceInput): Promise<ProvisionedDeviceSummary> {
  const normalizedSsid = wifi.ssid.trim();
  const normalizedPassword = wifi.password.trim();

  if (!normalizedSsid || !normalizedPassword) {
    throw new Error("Wi-Fi credentials are required for AP provisioning.");
  }

  const descriptor = getApSetupDescriptor();
  const intent = await registerProvisioningIntent(session, {
    method: "ap",
    pid: descriptor.pid
  });
  const progression = getProvisioningSequence("ap");

  for (const status of progression.slice(1, 4)) {
    await waitForNextStep();
    onStatusChange?.(status);
  }

  const record = await registerProvisionedDevice(session, {
    deviceId: createApDeviceId(),
    pid: descriptor.pid,
    displayName: descriptor.productName,
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
    productName: descriptor.productName
  };
}
