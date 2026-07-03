import { foundationPidBlueprint } from "@jenix/device-schemas";
import {
  createDeviceRecord,
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type DeviceRecord,
  type HomeRecord
} from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import {
  listDemoDevices,
  resetDemoDevices,
  setDemoDevices
} from "./deviceDemoStore";

export interface DashboardDevice {
  deviceId: string;
  displayName: string;
  pid: string;
  pidLabel: string;
  pidIconText: string;
  online: boolean;
  telemetryPreview: string;
}

const deviceEndpoint = "/api/v1/devices";
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

function getPidLabel(pid: string): string {
  if (pid === foundationPidBlueprint.pid) {
    return foundationPidBlueprint.productName;
  }

  return "Jenix Device";
}

function getPidIconText(pid: string): string {
  return pid
    .split("-")
    .slice(1, 3)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function mapDeviceToDashboardDevice(device: DeviceRecord): DashboardDevice {
  return {
    deviceId: device.deviceId,
    displayName: device.displayName,
    pid: device.pid,
    pidLabel: getPidLabel(device.pid),
    pidIconText: getPidIconText(device.pid),
    online: device.mqttStatus === "online" || device.cloudStatus === "online",
    telemetryPreview:
      device.lastSeenAt
        ? `Last seen ${new Date(device.lastSeenAt).toLocaleTimeString()}`
        : "No telemetry yet"
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function getHomes(session: AuthSession): HomeRecord[] {
  return ensureDefaultHome(session.homes, session.user.userId);
}

export function getCurrentHome(session: AuthSession): HomeRecord {
  return getSelectedHome(
    getHomes(session),
    session.user.userId,
    session.activeHomeId
  );
}

export async function getDashboardDevices(
  session: AuthSession
): Promise<DashboardDevice[]> {
  const currentHome = getCurrentHome(session);

  try {
    const devices = await fetchJson<DeviceRecord[]>(deviceEndpoint, {
      method: "GET",
      headers: createAuthenticatedHeaders(session, {
        homeId: currentHome.homeId
      })
    });

    return devices.map(mapDeviceToDashboardDevice);
  } catch {
    return listDemoDevices(session.user.userId, currentHome.homeId).map(
      mapDeviceToDashboardDevice
    );
  }
}

export async function renameDashboardDevice(
  session: AuthSession,
  deviceId: string,
  displayName: string
): Promise<DashboardDevice> {
  const currentHome = getCurrentHome(session);

  try {
    const device = await fetchJson<DeviceRecord>(
      `${deviceEndpoint}/${encodeURIComponent(deviceId)}/rename`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify({
          displayName
        })
      }
    );

    return mapDeviceToDashboardDevice(device);
  } catch {
    const devices = listDemoDevices(session.user.userId, currentHome.homeId);
    const updatedDevices = devices.map((device) =>
      device.deviceId === deviceId
        ? {
            ...device,
            displayName,
            updatedAt: new Date().toISOString()
          }
        : device
    );

    setDemoDevices(session.user.userId, currentHome.homeId, updatedDevices);

    const updatedDevice = updatedDevices.find((device) => device.deviceId === deviceId);
    if (!updatedDevice) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return mapDeviceToDashboardDevice(updatedDevice);
  }
}

export const dashboardApiTesting = {
  resetDemoStore() {
    resetDemoDevices();
  },
  seedDemoDevices(userId: string, homeId: string, devices: DeviceRecord[]) {
    setDemoDevices(userId, homeId, devices);
  },
  createDemoDevice(input: {
    deviceId: string;
    ownerUserId: string;
    homeId: string;
    displayName?: string;
    pid?: string;
    mqttStatus?: DeviceRecord["mqttStatus"];
    cloudStatus?: DeviceRecord["cloudStatus"];
  }): DeviceRecord {
    const base = createDeviceRecord({
      deviceId: input.deviceId,
      pid: input.pid ?? foundationPidBlueprint.pid,
      homeId: input.homeId,
      ownerUserId: input.ownerUserId,
      ...optionalProp("displayName", input.displayName)
    });

    return {
      ...base,
      mqttStatus: input.mqttStatus ?? "online",
      cloudStatus: input.cloudStatus ?? "online",
      lastSeenAt: new Date("2026-07-01T00:00:00.000Z").toISOString()
    };
  }
};
