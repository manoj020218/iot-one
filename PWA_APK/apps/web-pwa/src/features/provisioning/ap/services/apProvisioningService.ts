import { foundationPidBlueprint } from "@jenix/device-schemas";
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

/**
 * Gateway address every Jenix device's SoftAP hands out per PROVISIONING.md
 * (repo root) -- the phone must already be connected to the device's own
 * `JNX...` hotspot for this request to reach anything.
 */
const AP_GATEWAY_URL = "http://192.168.4.1";
const AP_PROVISION_TIMEOUT_MS = 15000;

const apSetupDescriptor: ApSetupDescriptor = {
  apSsid: "JENIX-SETUP-TG-C3",
  pid: foundationPidBlueprint.pid,
  productName: foundationPidBlueprint.productName
};

interface ApSetWifiResponse {
  ok: boolean;
  wifi_connected: boolean;
  ip?: string;
}

function isApSetWifiResponse(value: unknown): value is ApSetWifiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { wifi_connected?: unknown }).wifi_connected === "boolean"
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createApDeviceId() {
  return `JNX-TG-C3-${Date.now().toString(36).slice(-4)}${Math.random()
    .toString(36)
    .slice(2, 4)}`.toUpperCase();
}

export function getApSetupDescriptor(): ApSetupDescriptor {
  return clone(apSetupDescriptor);
}

/**
 * Sends Wi-Fi credentials to the device's local SoftAP web server. Mirrors
 * the BLE set_wifi command's payload/response shape exactly (PROVISIONING.md
 * section 4a) so firmware only needs one JSON contract for both transports.
 * This only works when the phone's own network connection is currently the
 * device's `JNX...` hotspot -- there is no way to verify that from here
 * beyond the request itself failing or timing out.
 */
async function sendWifiCredentialsOverAp(
  wifi: WifiCredentialPayload
): Promise<ApSetWifiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AP_PROVISION_TIMEOUT_MS);

  try {
    const response = await fetch(`${AP_GATEWAY_URL}/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "set_wifi", ssid: wifi.ssid, password: wifi.password }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Device rejected the request (status ${response.status}).`);
    }

    const parsed: unknown = await response.json();

    if (!isApSetWifiResponse(parsed)) {
      throw new Error("Device sent back an unexpected response.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The device did not respond. Make sure your phone is still connected to its JNX... Wi-Fi network."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

  const result = await sendWifiCredentialsOverAp({
    ssid: normalizedSsid,
    password: normalizedPassword
  });

  onStatusChange?.("WIFI_SENT");

  if (!result.wifi_connected) {
    throw new Error(
      "The device could not join that Wi-Fi network. Check the password and try again."
    );
  }

  onStatusChange?.("DEVICE_CONNECTING_WIFI");

  const record = await registerProvisionedDevice(session, {
    deviceId: createApDeviceId(),
    pid: descriptor.pid,
    displayName: descriptor.productName,
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
    productName: descriptor.productName
  };
}
