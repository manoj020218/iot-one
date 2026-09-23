import { randomBytes } from "node:crypto";

import { deviceRepository } from "../devices/device.model";
import { DeviceModuleError } from "../devices/device.types";
import { getDeviceCredential, saveDeviceCredential } from "./device-enrollment.model";
import type { DeviceCloudConfigResponse } from "./device-enrollment.types";

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

// Public broker address handed to devices -- may differ from whatever
// internal MQTT_URL the backend's own runtime bridge dials in on. Read
// directly, same inline process.env style require-device-auth.ts already
// uses for DEVICE_INGEST_KEY, rather than threading through readAppConfig()
// (which only main.ts currently calls).
function deviceMqttHost(): string {
  return process.env.DEVICE_MQTT_HOST?.trim() || "mqtt.iotsoft.in";
}

function deviceMqttPort(): number {
  const raw = process.env.DEVICE_MQTT_PORT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1883;
}

async function issueDeviceCredential(deviceId: string) {
  const existing = await getDeviceCredential(deviceId);
  if (existing) {
    return existing;
  }

  const record = {
    deviceId,
    mqttUsername: deviceId,
    mqttPassword: randomBytes(9).toString("base64url"),
    issuedAt: new Date().toISOString()
  };

  await saveDeviceCredential(record);
  return record;
}

// Called by the device itself (see require-device-auth.ts's x-device-key
// gate on the route) once it has Wi-Fi but no cloud config yet. A 404 here
// is the expected, normal case when the device's Wi-Fi connects before the
// phone app finishes POST /register -- callers must treat it as "keep
// retrying," not fatal (see NEW_PRODUCT_LAUNCH_SOP.md-adjacent firmware
// backoff logic in CloudEnrollmentService).
export async function issueOrGetDeviceCloudConfig(
  deviceId: string
): Promise<DeviceCloudConfigResponse> {
  const normalized = normalizeDeviceId(deviceId);
  const device = await deviceRepository.get(normalized);

  if (!device) {
    throw new DeviceModuleError(404, `Device not found: ${normalized}`);
  }

  const credential = await issueDeviceCredential(normalized);

  return {
    // The MQTT bridge parses the tenant segment out of
    // jnx/{tenantId}/{pid}/{deviceId}/... topics (mqtt-runtime-bridge.ts) --
    // tenantId, not homeId, is the field that actually matters here. They're
    // equal by default (createDeviceRecord), but only tenantId is correct
    // once a vendor/OEM tenant ever diverges the two.
    homeId: device.tenantId,
    mqttHost: deviceMqttHost(),
    mqttPort: deviceMqttPort(),
    mqttUsername: credential.mqttUsername,
    mqttPassword: credential.mqttPassword
  };
}
