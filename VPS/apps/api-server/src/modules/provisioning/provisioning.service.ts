import type { ProvisioningStatus } from "@jenix/shared";

import { provisioningRepository } from "./provisioning.model";
import type {
  CompleteProvisioningPayload,
  ProvisioningRequestContext,
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

function requireContextHomeId(context: ProvisioningRequestContext): string {
  if (!context.homeId) {
    throw new ProvisioningModuleError(400, "Provisioning actions require x-home-id");
  }

  return context.homeId;
}

async function requireIntent(
  provisioningId: string
): Promise<ProvisioningIntentRecord> {
  const record = await provisioningRepository.get(provisioningId);

  if (!record) {
    throw new ProvisioningModuleError(404, `Provisioning intent not found: ${provisioningId}`);
  }

  return record;
}

function assertIntentAccess(
  record: ProvisioningIntentRecord,
  context: ProvisioningRequestContext
): ProvisioningIntentRecord {
  if (record.userId !== context.userId) {
    throw new ProvisioningModuleError(403, "Provisioning access denied");
  }

  if (context.homeId && record.homeId !== context.homeId) {
    throw new ProvisioningModuleError(403, "Provisioning access denied");
  }

  return record;
}

export function registerProvisioningIntent(
  payload: RegisterProvisioningIntentPayload,
  context: ProvisioningRequestContext
): Promise<ProvisioningIntentRecord> {
  const timestamp = new Date().toISOString();
  const record: ProvisioningIntentRecord = {
    provisioningId: createProvisioningId(),
    userId: context.userId,
    homeId: requireContextHomeId(context),
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
  payload: CompleteProvisioningPayload,
  context: ProvisioningRequestContext
): Promise<ProvisioningIntentRecord> {
  return requireIntent(provisioningId).then((existing) => {
    const accessibleIntent = assertIntentAccess(existing, context);
    const nextStatus: ProvisioningStatus = payload.status ?? "SUCCESS";
    const updated: ProvisioningIntentRecord = {
      ...accessibleIntent,
      deviceId: payload.deviceId.trim().toUpperCase(),
      updatedAt: new Date().toISOString(),
      status: nextStatus,
      ...(payload.pid ? { pid: payload.pid.trim().toUpperCase() } : {})
    };

    return provisioningRepository.save(updated);
  });
}

export function getProvisioningStatus(
  provisioningId: string,
  context: ProvisioningRequestContext
): Promise<ProvisioningIntentRecord> {
  return requireIntent(provisioningId).then((existing) =>
    assertIntentAccess(existing, context)
  );
}

export const provisioningTesting = {
  reset() {
    return provisioningRepository.reset();
  }
};
