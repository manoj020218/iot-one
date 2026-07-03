import { foundationPidBlueprint } from "@jenix/device-schemas";
import {
  createDeviceRecord,
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type DeviceRecord,
  type ProvisioningIntent,
  type ProvisioningMethod,
  type ProvisioningStatus
} from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import { upsertDemoDevice } from "../../dashboard/services/deviceDemoStore";

const provisioningEndpoint = "/api/v1/provisioning";
const devicesEndpoint = "/api/v1/devices";
const localIntentStore = new Map<string, ProvisioningIntent>();

interface RegisterProvisioningIntentInput {
  method: ProvisioningMethod;
  pid?: string;
}

interface CompleteProvisioningIntentInput {
  deviceId: string;
  pid?: string;
  status?: ProvisioningStatus;
}

export interface RegisterProvisionedDeviceInput {
  deviceId: string;
  pid: string;
  displayName: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  matterEnabled?: boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value
  } as Record<K, V>;
}

function createLocalProvisioningId(): string {
  return `prov-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentHome(session: AuthSession) {
  return getSelectedHome(
    ensureDefaultHome(session.homes, session.user.userId),
    session.user.userId,
    session.activeHomeId
  );
}

function getInitialStatus(method: ProvisioningMethod): ProvisioningStatus {
  return method === "ble" ? "BLE_CONNECTED" : "WIFI_SENT";
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function patchProvisionedDeviceState(
  session: AuthSession,
  deviceId: string
): Promise<DeviceRecord> {
  const currentHome = getCurrentHome(session);

  return fetchJson<DeviceRecord>(`${devicesEndpoint}/${encodeURIComponent(deviceId)}`, {
    method: "PATCH",
    headers: createAuthenticatedHeaders(session, {
      contentType: "application/json",
      homeId: currentHome.homeId
    }),
    body: JSON.stringify({
      mqttStatus: "online",
      cloudStatus: "online",
      localStatus: "available",
      lastSeenAt: new Date().toISOString()
    })
  });
}

function createFallbackIntent(
  session: AuthSession,
  input: RegisterProvisioningIntentInput
): ProvisioningIntent {
  const timestamp = new Date().toISOString();
  const currentHome = getCurrentHome(session);
  const record: ProvisioningIntent = {
    provisioningId: createLocalProvisioningId(),
    userId: session.user.userId,
    homeId: currentHome.homeId,
    method: input.method,
    status: getInitialStatus(input.method),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(input.pid ? { pid: input.pid.trim().toUpperCase() } : {})
  };

  localIntentStore.set(record.provisioningId, clone(record));
  return record;
}

function createFallbackDevice(
  session: AuthSession,
  input: RegisterProvisionedDeviceInput
): DeviceRecord {
  const now = new Date();
  const currentHome = getCurrentHome(session);
  const record = createDeviceRecord(
    {
      deviceId: input.deviceId,
      pid: input.pid,
      homeId: currentHome.homeId,
      ownerUserId: session.user.userId,
      displayName: input.displayName,
      ...optionalProp("firmwareVersion", input.firmwareVersion),
      ...optionalProp("hardwareRevision", input.hardwareRevision),
      ...optionalProp("matterEnabled", input.matterEnabled)
    },
    now
  );

  return {
    ...record,
    localStatus: "available",
    mqttStatus: "online",
    cloudStatus: "online",
    lastSeenAt: now.toISOString()
  };
}

export async function registerProvisioningIntent(
  session: AuthSession,
  input: RegisterProvisioningIntentInput
): Promise<ProvisioningIntent> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<ProvisioningIntent>(`${provisioningEndpoint}/register-intent`, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json",
        homeId: currentHome.homeId
      }),
      body: JSON.stringify({
        method: input.method,
        pid: input.pid ?? foundationPidBlueprint.pid
      })
    });
  } catch {
    return createFallbackIntent(session, input);
  }
}

export async function completeProvisioningIntent(
  session: AuthSession,
  provisioningId: string,
  input: CompleteProvisioningIntentInput
): Promise<ProvisioningIntent> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<ProvisioningIntent>(
      `${provisioningEndpoint}/${encodeURIComponent(provisioningId)}/complete`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify(input)
      }
    );
  } catch {
    const existing = localIntentStore.get(provisioningId);

    if (!existing) {
      throw new Error(`Provisioning intent not found: ${provisioningId}`);
    }

    const updated: ProvisioningIntent = {
      ...existing,
      deviceId: input.deviceId.trim().toUpperCase(),
      updatedAt: new Date().toISOString(),
      status: input.status ?? "SUCCESS",
      ...(input.pid ? { pid: input.pid.trim().toUpperCase() } : {})
    };

    localIntentStore.set(updated.provisioningId, clone(updated));
    return updated;
  }
}

export async function registerProvisionedDevice(
  session: AuthSession,
  input: RegisterProvisionedDeviceInput
): Promise<DeviceRecord> {
  const currentHome = getCurrentHome(session);

  try {
    const registeredRecord = await fetchJson<DeviceRecord>(`${devicesEndpoint}/register`, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json",
        homeId: currentHome.homeId
      }),
      body: JSON.stringify({
        deviceId: input.deviceId,
        pid: input.pid,
        homeId: currentHome.homeId,
        ownerUserId: session.user.userId,
        displayName: input.displayName,
        firmwareVersion: input.firmwareVersion,
        hardwareRevision: input.hardwareRevision,
        matterEnabled: input.matterEnabled
      })
    });

    let record = registeredRecord;

    try {
      record = await patchProvisionedDeviceState(session, registeredRecord.deviceId);
    } catch {
      record = registeredRecord;
    }

    upsertDemoDevice(session.user.userId, currentHome.homeId, record);
    return record;
  } catch {
    const record = createFallbackDevice(session, input);
    upsertDemoDevice(session.user.userId, currentHome.homeId, record);
    return record;
  }
}

export const provisioningApiTesting = {
  reset() {
    localIntentStore.clear();
  }
};
