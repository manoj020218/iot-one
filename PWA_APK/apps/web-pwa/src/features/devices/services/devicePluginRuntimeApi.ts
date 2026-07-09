import {
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type DeviceRecord,
  type DeviceUiCommandAckRecord,
  type DeviceUiCommandRequest,
  type DeviceUiRuntimeState
} from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";

const deviceEndpoint = "/api/v1/devices";
const demoRuntimeStore = new Map<string, DeviceUiRuntimeState>();

function getCurrentHome(session: AuthSession) {
  return getSelectedHome(
    ensureDefaultHome(session.homes, session.user.userId),
    session.user.userId,
    session.activeHomeId
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function buildDefaultRuntime(device: DeviceRecord): DeviceUiRuntimeState {
  return {
    deviceId: device.deviceId,
    pid: device.pid,
    telemetrySnapshot: {
      deviceId: device.deviceId,
      pid: device.pid,
      occurredAt: device.lastSeenAt ?? new Date().toISOString(),
      telemetry: {
        tankLevelPct: 0,
        tankLevelMm: 0,
        zeroLevelMm: 0,
        bottomLevelMm: 0,
        topLevelMm: 1000,
        flowLitresPerMin: 0,
        wifiRssi: -78,
        wifiSsidName: "",
        localIp: "",
        localUrl: "",
        wifiTxPowerDbm: 8.5,
        alarmState: "normal",
        sensorStatus: "ready",
        pumpRunning: false
      },
      history: [0]
    },
    settings: {}
  };
}

export async function getDeviceUiRuntime(
  session: AuthSession,
  device: DeviceRecord
): Promise<DeviceUiRuntimeState> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<DeviceUiRuntimeState>(
      `${deviceEndpoint}/${encodeURIComponent(device.deviceId)}/ui-runtime`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch {
    const existing = demoRuntimeStore.get(device.deviceId);

    if (existing) {
      return structuredClone(existing);
    }

    const fallback = buildDefaultRuntime(device);
    demoRuntimeStore.set(device.deviceId, fallback);
    return structuredClone(fallback);
  }
}

export async function dispatchDeviceUiCommand(
  session: AuthSession,
  device: DeviceRecord,
  input: DeviceUiCommandRequest
): Promise<DeviceUiCommandAckRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<DeviceUiCommandAckRecord>(
      `${deviceEndpoint}/${encodeURIComponent(device.deviceId)}/commands`,
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
    const current =
      demoRuntimeStore.get(device.deviceId) ?? buildDefaultRuntime(device);
    const ack: DeviceUiCommandAckRecord = {
      commandId: `ui-demo-${Date.now().toString(36)}`,
      deviceId: device.deviceId,
      status: "queued",
      queuedAt: new Date().toISOString(),
      ...(input.payload ? { payload: input.payload } : {})
    };

    if (isRecord(input.payload?.settings)) {
      current.settings = structuredClone(input.payload.settings);
    }

    current.lastCommand = ack;
    demoRuntimeStore.set(device.deviceId, current);
    return structuredClone(ack);
  }
}

export const devicePluginRuntimeApiTesting = {
  reset() {
    demoRuntimeStore.clear();
  },
  seedRuntime(runtime: DeviceUiRuntimeState) {
    demoRuntimeStore.set(runtime.deviceId, structuredClone(runtime));
  }
};
