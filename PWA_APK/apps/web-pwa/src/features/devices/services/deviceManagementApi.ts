import {
  foundationPidBlueprint,
  type CreatePidInput
} from "@jenix/device-schemas";
import {
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type DeviceFirmwareChannel,
  type DeviceFirmwareRequestResult,
  type DeviceRecord,
  type HomeAccessRole
} from "@jenix/shared";

import {
  listDemoDevices,
  resetDemoDevices,
  setDemoDevices
} from "../../dashboard/services/deviceDemoStore";

export interface ManagedDeviceSummary {
  deviceId: string;
  displayName: string;
  pid: string;
  pidLabel: string;
  pidIconText: string;
  homeId: string;
  online: boolean;
  mqttStatus: DeviceRecord["mqttStatus"];
  cloudStatus: DeviceRecord["cloudStatus"];
  localStatus?: DeviceRecord["localStatus"];
  firmwareVersion?: string;
  hardwareRevision?: string;
  matterEnabled?: boolean;
  lastSeenAt?: string;
  telemetryPreview: string;
}

export interface DeviceFirmwarePlan {
  currentVersion?: string;
  stableVersion?: string;
  betaVersion?: string;
  recommendedChannel: DeviceFirmwareChannel;
  availableTargetVersion?: string;
  canRequest: boolean;
  blockedReason?: string;
}

export interface RequestFirmwareUpdateInput {
  channel?: DeviceFirmwareChannel;
  targetVersion?: string;
}

export type DevicePidProfile = CreatePidInput;

const deviceEndpoint = "/api/v1/devices";
const pidEndpoint = "/api/v1/pids";
const demoPidProfiles = new Map<string, DevicePidProfile>([
  [foundationPidBlueprint.pid, structuredClone(foundationPidBlueprint)]
]);

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

function getHomes(session: AuthSession) {
  return ensureDefaultHome(session.homes, session.user.userId);
}

function getCurrentHome(session: AuthSession) {
  return getSelectedHome(
    getHomes(session),
    session.user.userId,
    session.activeHomeId
  );
}

function getHomeRole(session: AuthSession): HomeAccessRole {
  return getCurrentHome(session).role;
}

function getPidLabel(pid: string): string {
  const profile = demoPidProfiles.get(pid.trim().toUpperCase());
  return profile?.productName ?? "Jenix Device";
}

function getPidIconText(pid: string): string {
  return pid
    .split("-")
    .slice(1, 3)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function toTelemetryPreview(device: DeviceRecord) {
  return device.lastSeenAt
    ? `Last seen ${new Date(device.lastSeenAt).toLocaleTimeString()}`
    : "No telemetry yet";
}

function mapDeviceToSummary(device: DeviceRecord): ManagedDeviceSummary {
  return {
    deviceId: device.deviceId,
    displayName: device.displayName,
    pid: device.pid,
    pidLabel: getPidLabel(device.pid),
    pidIconText: getPidIconText(device.pid),
    homeId: device.homeId,
    online: device.mqttStatus === "online" || device.cloudStatus === "online",
    mqttStatus: device.mqttStatus,
    cloudStatus: device.cloudStatus,
    ...optionalProp("localStatus", device.localStatus),
    ...optionalProp("firmwareVersion", device.firmwareVersion),
    ...optionalProp("hardwareRevision", device.hardwareRevision),
    ...optionalProp("matterEnabled", device.matterEnabled),
    ...optionalProp("lastSeenAt", device.lastSeenAt),
    telemetryPreview: toTelemetryPreview(device)
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

function getDemoDevice(session: AuthSession, deviceId: string): DeviceRecord {
  const currentHome = getCurrentHome(session);
  const device = listDemoDevices(session.user.userId, currentHome.homeId).find(
    (item) => item.deviceId === deviceId
  );

  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  return device;
}

function resolveFirmwareTargetVersion(
  pidProfile: DevicePidProfile,
  channel: DeviceFirmwareChannel,
  targetVersion?: string
) {
  const resolvedVersion =
    targetVersion?.trim() ||
    (channel === "beta"
      ? pidProfile.firmware.betaVersion
      : pidProfile.firmware.stableVersion);

  if (!resolvedVersion) {
    throw new Error(`No ${channel} firmware release is available for ${pidProfile.pid}`);
  }

  return resolvedVersion;
}

export function buildFirmwarePlan(
  device: DeviceRecord,
  pidProfile: DevicePidProfile,
  homeRole: HomeAccessRole
): DeviceFirmwarePlan {
  const currentVersion = device.firmwareVersion;
  const stableVersion = pidProfile.firmware.stableVersion;
  const betaVersion = pidProfile.firmware.betaVersion;
  const recommendedChannel =
    stableVersion && stableVersion !== currentVersion ? "stable" : "beta";
  const availableTargetVersion =
    recommendedChannel === "stable" ? stableVersion : betaVersion;

  if (homeRole === "viewer") {
    return {
      recommendedChannel,
      canRequest: false,
      blockedReason: "Viewer access cannot request firmware updates.",
      ...optionalProp("currentVersion", currentVersion),
      ...optionalProp("stableVersion", stableVersion),
      ...optionalProp("betaVersion", betaVersion),
      ...optionalProp("availableTargetVersion", availableTargetVersion)
    };
  }

  return {
    recommendedChannel,
    canRequest: Boolean(availableTargetVersion),
    ...optionalProp("currentVersion", currentVersion),
    ...optionalProp("stableVersion", stableVersion),
    ...optionalProp("betaVersion", betaVersion),
    ...optionalProp("availableTargetVersion", availableTargetVersion)
  };
}

export async function listManagedDevices(
  session: AuthSession
): Promise<ManagedDeviceSummary[]> {
  const currentHome = getCurrentHome(session);

  try {
    const devices = await fetchJson<DeviceRecord[]>(deviceEndpoint, {
      method: "GET",
      headers: {
        "x-user-id": session.user.userId,
        "x-home-id": currentHome.homeId,
        "x-home-role": getHomeRole(session)
      }
    });

    return devices.map(mapDeviceToSummary);
  } catch {
    return listDemoDevices(session.user.userId, currentHome.homeId).map(mapDeviceToSummary);
  }
}

export async function getManagedDevice(
  session: AuthSession,
  deviceId: string
): Promise<DeviceRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<DeviceRecord>(
      `${deviceEndpoint}/${encodeURIComponent(deviceId)}`,
      {
        method: "GET",
        headers: {
          "x-user-id": session.user.userId,
          "x-home-id": currentHome.homeId,
          "x-home-role": getHomeRole(session)
        }
      }
    );
  } catch {
    return getDemoDevice(session, deviceId);
  }
}

export async function getDevicePidProfile(pid: string): Promise<DevicePidProfile> {
  const normalizedPid = pid.trim().toUpperCase();

  try {
    return await fetchJson<DevicePidProfile>(
      `${pidEndpoint}/${encodeURIComponent(normalizedPid)}`,
      {
        method: "GET"
      }
    );
  } catch {
    const profile = demoPidProfiles.get(normalizedPid);

    if (!profile) {
      throw new Error(`PID profile not found: ${normalizedPid}`);
    }

    return clone(profile);
  }
}

export async function requestFirmwareUpdate(
  session: AuthSession,
  deviceId: string,
  input: RequestFirmwareUpdateInput
): Promise<DeviceFirmwareRequestResult> {
  const currentHome = getCurrentHome(session);
  const homeRole = getHomeRole(session);

  if (homeRole === "viewer") {
    throw new Error("Viewer access cannot request firmware updates.");
  }

  try {
    return await fetchJson<DeviceFirmwareRequestResult>(
      `${deviceEndpoint}/${encodeURIComponent(deviceId)}/firmware/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": session.user.userId,
          "x-home-id": currentHome.homeId,
          "x-home-role": homeRole
        },
        body: JSON.stringify(input)
      }
    );
  } catch {
    const device = getDemoDevice(session, deviceId);
    const pidProfile = await getDevicePidProfile(device.pid);
    const channel = input.channel ?? "stable";
    const targetVersion = resolveFirmwareTargetVersion(
      pidProfile,
      channel,
      input.targetVersion
    );

    return {
      deviceId: device.deviceId,
      pid: device.pid,
      channel,
      targetVersion,
      ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
      status:
        device.firmwareVersion === targetVersion ? "up_to_date" : "queued",
      requestedAt: new Date().toISOString()
    };
  }
}

export const deviceManagementApiTesting = {
  reset() {
    resetDemoDevices();
    demoPidProfiles.clear();
    demoPidProfiles.set(
      foundationPidBlueprint.pid,
      structuredClone(foundationPidBlueprint)
    );
  },
  seedDemoDevices(userId: string, homeId: string, devices: DeviceRecord[]) {
    setDemoDevices(userId, homeId, devices);
  },
  seedPidProfile(profile: DevicePidProfile) {
    demoPidProfiles.set(profile.pid.trim().toUpperCase(), clone(profile));
  }
};
