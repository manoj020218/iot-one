import type { ProvisioningStatus } from "@jenix/shared";

import { provisioningRepository } from "./provisioning.model";
import type {
  CompleteProvisioningPayload,
  ProvisioningIntentRecord,
  RegisterProvisioningIntentPayload
} from "./provisioning.types";
import { ProvisioningModuleError } from "./provisioning.types";

function createProvisioningId(): string {
  return `prov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getInitialProvisioningStatus(
  method: RegisterProvisioningIntentPayload["method"]
): ProvisioningStatus {
  return method === "ble" ? "BLE_CONNECTED" : "WIFI_SENT";
}

function requireIntent(provisioningId: string): ProvisioningIntentRecord {
  const record = provisioningRepository.get(provisioningId);

  if (!record) {
    throw new ProvisioningModuleError(404, `Provisioning intent not found: ${provisioningId}`);
  }

  return record;
}

export function registerProvisioningIntent(
  payload: RegisterProvisioningIntentPayload
): ProvisioningIntentRecord {
  const timestamp = new Date().toISOString();
  const record: ProvisioningIntentRecord = {
    provisioningId: createProvisioningId(),
    userId: payload.userId,
    homeId: payload.homeId,
    method: payload.method,
    status: getInitialProvisioningStatus(payload.method),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(payload.pid ? { pid: payload.pid.trim().toUpperCase() } : {})
  };

  return provisioningRepository.save(record);
}

export function completeProvisioning(
  provisioningId: string,
  payload: CompleteProvisioningPayload
): ProvisioningIntentRecord {
  const existing = requireIntent(provisioningId);
  const nextStatus: ProvisioningStatus = payload.status ?? "SUCCESS";
  const updated: ProvisioningIntentRecord = {
    ...existing,
    deviceId: payload.deviceId.trim().toUpperCase(),
    updatedAt: new Date().toISOString(),
    status: nextStatus,
    ...(payload.pid ? { pid: payload.pid.trim().toUpperCase() } : {})
  };

  return provisioningRepository.save(updated);
}

export function getProvisioningStatus(
  provisioningId: string
): ProvisioningIntentRecord {
  return requireIntent(provisioningId);
}

export const provisioningTesting = {
  reset() {
    provisioningRepository.reset();
  }
};
