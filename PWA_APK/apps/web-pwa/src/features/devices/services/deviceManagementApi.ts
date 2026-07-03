import {
  foundationPidBlueprint,
  type CreatePidInput
} from "@jenix/device-schemas";
import {
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type DeviceFirmwareChannel,
  type DeviceFirmwarePlanResponse,
  type DeviceFirmwareRequestResult,
  type DeviceFirmwareRolloutRecord,
  type DeviceRecord,
  type HomeAccessRole,
  type MatterBridgeState,
  type MatterCommissioningState,
  type MatterDeviceStatus,
  type MatterPlaceholderActionResult
} from "@jenix/shared";

import {
  listDemoDevices,
  resetDemoDevices,
  setDemoDevices
} from "../../dashboard/services/deviceDemoStore";
import { createAuthenticatedHeaders } from "../../../app/apiHeaders";

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
  stableStatus?: DeviceFirmwarePlanResponse["stable"]["status"];
  betaStatus?: DeviceFirmwarePlanResponse["beta"]["status"];
  stableReason?: string;
  betaReason?: string;
  canRequest: boolean;
  blockedReason?: string;
}

export interface RequestFirmwareUpdateInput {
  channel?: DeviceFirmwareChannel;
  targetVersion?: string;
}

export type DevicePidProfile = CreatePidInput;
export type DeviceFirmwareRollout = DeviceFirmwareRolloutRecord;

const deviceEndpoint = "/api/v1/devices";
const matterEndpoint = "/api/v1/matter/devices";
const pidEndpoint = "/api/v1/pids";
const demoPidProfiles = new Map<string, DevicePidProfile>([
  [foundationPidBlueprint.pid, structuredClone(foundationPidBlueprint)]
]);
const demoMatterRuntime = new Map<
  string,
  {
    commissioningState?: MatterCommissioningState;
    bridgeState?: MatterBridgeState;
    lastCommissioningAttemptAt?: string;
    lastBridgeSyncAt?: string;
  }
>();
const demoFirmwareRollouts = new Map<string, DeviceFirmwareRollout[]>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function createRequestId(): string {
  return `ota-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function canManageMatter(role: HomeAccessRole): boolean {
  return role === "owner" || role === "admin";
}

function getDemoRolloutStore(deviceId: string) {
  return demoFirmwareRollouts.get(normalizeDeviceId(deviceId)) ?? [];
}

function setDemoRolloutStore(deviceId: string, rollouts: DeviceFirmwareRollout[]) {
  demoFirmwareRollouts.set(
    normalizeDeviceId(deviceId),
    rollouts.map((rollout) => clone(rollout))
  );
}

function listDemoFirmwareRollouts(deviceId: string): DeviceFirmwareRollout[] {
  return [...getDemoRolloutStore(deviceId)]
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
    .map((rollout) => clone(rollout));
}

function appendDemoFirmwareRollout(rollout: DeviceFirmwareRollout) {
  setDemoRolloutStore(rollout.deviceId, [
    ...getDemoRolloutStore(rollout.deviceId),
    clone(rollout)
  ]);
}

function getDemoMatterRuntime(deviceId: string) {
  return demoMatterRuntime.get(normalizeDeviceId(deviceId));
}

function saveDemoMatterRuntime(
  deviceId: string,
  patch: {
    commissioningState?: MatterCommissioningState;
    bridgeState?: MatterBridgeState;
    lastCommissioningAttemptAt?: string;
    lastBridgeSyncAt?: string;
  }
) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const nextValue = {
    ...(demoMatterRuntime.get(normalizedDeviceId) ?? {}),
    ...patch
  };

  demoMatterRuntime.set(normalizedDeviceId, clone(nextValue));
  return clone(nextValue);
}

function buildLocalMatterStatus(
  device: DeviceRecord,
  pidProfile: DevicePidProfile
): MatterDeviceStatus {
  const activationEnabled = false;
  const activationMessage =
    "Matter remains planned at the MQTT/VPS layer only until multi-product rollout, vendor ID assignment, and CSA readiness are complete.";
  const runtime = getDemoMatterRuntime(device.deviceId);
  const mode = pidProfile.matter.mode;
  const deviceMatterEnabled = device.matterEnabled ?? pidProfile.matter.enabled;
  const hardwareMatterCapable = pidProfile.hardware.hasMatter;
  const notes: string[] = [];
  let enabled = false;
  let readiness: MatterDeviceStatus["readiness"];
  let commissioningState: MatterDeviceStatus["commissioningState"];
  let bridgeState: MatterDeviceStatus["bridgeState"];

  if (!pidProfile.matter.enabled || mode === "NONE") {
    readiness = "disabled";
    commissioningState = "disabled";
    bridgeState = "not_required";
    notes.push("PID Matter mapping is disabled for this product.");
  } else if (!hardwareMatterCapable) {
    readiness = "not_supported";
    commissioningState = "not_supported";
    bridgeState = "not_supported";
    notes.push("The PID hardware profile is not marked as Matter-capable.");
  } else if (!deviceMatterEnabled) {
    readiness = "disabled";
    commissioningState = "disabled";
    bridgeState = mode === "MATTER_BRIDGE_GATEWAY" ? "disabled" : "not_required";
    notes.push("The device-level Matter toggle is disabled.");
  } else {
    enabled = true;

    switch (mode) {
      case "NATIVE_MATTER":
        readiness = "ready_to_commission";
        commissioningState =
          runtime?.commissioningState === "requested" ? "requested" : "ready";
        bridgeState = "not_required";
        notes.push("Native Matter commissioning can be staged from this device page.");
        break;
      case "MATTER_BRIDGE_GATEWAY":
        readiness = "bridge_ready";
        commissioningState =
          runtime?.commissioningState === "requested" ? "requested" : "ready";
        bridgeState =
          runtime?.bridgeState === "sync_requested"
            ? "sync_requested"
            : "gateway_ready";
        notes.push("This device is modeled as a Matter bridge gateway.");
        break;
      case "MATTER_BRIDGE_CHILD":
        readiness = "bridge_child";
        commissioningState = "bridge_child_only";
        bridgeState =
          runtime?.bridgeState === "sync_requested"
            ? "sync_requested"
            : "child_waiting_for_gateway";
        notes.push("Bridge child devices must be exposed through a Matter gateway.");
        break;
    }
  }

  return {
    deviceId: device.deviceId,
    pid: pidProfile.pid,
    enabled,
    activationEnabled,
    activationMessage,
    deviceMatterEnabled,
    hardwareMatterCapable,
    mode,
    readiness,
    commissioningState,
    bridgeState,
    mapping: {
      endpoints: clone(pidProfile.matter.endpoints ?? []),
      clusters: [...(pidProfile.matter.clusters ?? [])],
      bridgeSupported: pidProfile.matter.bridgeSupported,
      ...(pidProfile.matter.deviceType
        ? { deviceType: pidProfile.matter.deviceType }
        : {}),
      ...(pidProfile.matter.vendorId ? { vendorId: pidProfile.matter.vendorId } : {}),
      ...(pidProfile.matter.productId
        ? { productId: pidProfile.matter.productId }
        : {}),
      ...(pidProfile.matter.discriminator
        ? { discriminator: pidProfile.matter.discriminator }
        : {}),
      ...(pidProfile.matter.certificationStatus
        ? { certificationStatus: pidProfile.matter.certificationStatus }
        : {})
    },
    notes,
    ...(runtime?.lastCommissioningAttemptAt
      ? { lastCommissioningAttemptAt: runtime.lastCommissioningAttemptAt }
      : {}),
    ...(runtime?.lastBridgeSyncAt
      ? { lastBridgeSyncAt: runtime.lastBridgeSyncAt }
      : {})
  };
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

export function buildFirmwarePlanFromResponse(
  response: DeviceFirmwarePlanResponse,
  homeRole: HomeAccessRole
): DeviceFirmwarePlan {
  const stableVersion = response.stable.release?.version;
  const betaVersion = response.beta.release?.version;
  const preferredTargetVersion =
    response.recommendedChannel === "stable" ? stableVersion : betaVersion;

  if (homeRole === "viewer") {
    return {
      recommendedChannel: response.recommendedChannel,
      canRequest: false,
      blockedReason: "Viewer access cannot request firmware updates.",
      ...optionalProp("currentVersion", response.currentVersion),
      ...optionalProp("stableVersion", stableVersion),
      ...optionalProp("betaVersion", betaVersion),
      ...optionalProp("availableTargetVersion", preferredTargetVersion),
      ...optionalProp("stableStatus", response.stable.status),
      ...optionalProp("betaStatus", response.beta.status),
      ...optionalProp("stableReason", response.stable.reason),
      ...optionalProp("betaReason", response.beta.reason)
    };
  }

  return {
    recommendedChannel: response.recommendedChannel,
    canRequest:
      response.stable.status === "update_available" ||
      response.beta.status === "update_available" ||
      response.stable.status === "up_to_date" ||
      response.beta.status === "up_to_date",
    ...optionalProp("currentVersion", response.currentVersion),
    ...optionalProp("stableVersion", stableVersion),
    ...optionalProp("betaVersion", betaVersion),
    ...optionalProp("availableTargetVersion", preferredTargetVersion),
    ...optionalProp("stableStatus", response.stable.status),
    ...optionalProp("betaStatus", response.beta.status),
    ...optionalProp("stableReason", response.stable.reason),
    ...optionalProp("betaReason", response.beta.reason)
  };
}

export async function listManagedDevices(
  session: AuthSession
): Promise<ManagedDeviceSummary[]> {
  const currentHome = getCurrentHome(session);

  try {
    const devices = await fetchJson<DeviceRecord[]>(deviceEndpoint, {
      method: "GET",
      headers: createAuthenticatedHeaders(session, {
        homeId: currentHome.homeId
      })
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
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
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

export async function getResolvedFirmwarePlan(
  session: AuthSession,
  device: DeviceRecord,
  pidProfile: DevicePidProfile
): Promise<DeviceFirmwarePlan> {
  const currentHome = getCurrentHome(session);
  const homeRole = getHomeRole(session);

  try {
    const response = await fetchJson<DeviceFirmwarePlanResponse>(
      `${deviceEndpoint}/${encodeURIComponent(device.deviceId)}/firmware-plan`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );

    return buildFirmwarePlanFromResponse(response, homeRole);
  } catch {
    return buildFirmwarePlan(device, pidProfile, homeRole);
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
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
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
    const requestId = createRequestId();
    const requestedAt = new Date().toISOString();
    const status =
      device.firmwareVersion === targetVersion ? "up_to_date" : "queued";

    if (status === "queued") {
      appendDemoFirmwareRollout({
        requestId,
        deviceId: device.deviceId,
        homeId: device.homeId,
        pid: device.pid,
        channel,
        targetVersion,
        artifactUrl: `demo://ota/${encodeURIComponent(targetVersion)}`,
        checksum: `demo-checksum-${targetVersion}`,
        requestedAt,
        requestedBy: session.user.userId,
        ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
        attemptCount: 0,
        status: "queued"
      });
    }

    return {
      deviceId: device.deviceId,
      pid: device.pid,
      channel,
      targetVersion,
      ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
      status,
      requestedAt,
      ...(status === "queued"
        ? {
            requestId,
            deliveryState: "queued" as const
          }
        : {})
    };
  }
}

export async function listDeviceFirmwareRollouts(
  session: AuthSession,
  deviceId: string
): Promise<DeviceFirmwareRollout[]> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<DeviceFirmwareRollout[]>(
      `${deviceEndpoint}/${encodeURIComponent(deviceId)}/firmware/rollouts`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch {
    return listDemoFirmwareRollouts(deviceId);
  }
}

export async function replayFirmwareRollout(
  session: AuthSession,
  deviceId: string,
  requestId: string
): Promise<DeviceFirmwareRollout> {
  const currentHome = getCurrentHome(session);
  const homeRole = getHomeRole(session);

  if (homeRole === "viewer") {
    throw new Error("Viewer access cannot replay firmware rollouts.");
  }

  try {
    return await fetchJson<DeviceFirmwareRollout>(
      `${deviceEndpoint}/${encodeURIComponent(deviceId)}/firmware/rollouts/${encodeURIComponent(requestId)}/replay`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch {
    const device = getDemoDevice(session, deviceId);
    const existing = getDemoRolloutStore(deviceId).find(
      (rollout) => rollout.requestId === requestId
    );

    if (!existing) {
      throw new Error(`Firmware rollout not found: ${requestId}`);
    }

    if (existing.status !== "failed") {
      throw new Error(`Only failed firmware rollouts can be replayed: ${requestId}`);
    }

    const replayedRollout: DeviceFirmwareRollout = {
      requestId: createRequestId(),
      deviceId: device.deviceId,
      homeId: device.homeId,
      pid: existing.pid,
      channel: existing.channel,
      targetVersion: existing.targetVersion,
      artifactUrl: existing.artifactUrl,
      checksum: existing.checksum,
      requestedAt: new Date().toISOString(),
      requestedBy: session.user.userId,
      ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
      attemptCount: 0,
      status: "queued",
      replayedFromRequestId: existing.requestId
    };

    appendDemoFirmwareRollout(replayedRollout);
    return replayedRollout;
  }
}

export async function getMatterStatus(
  session: AuthSession,
  device: DeviceRecord,
  pidProfile: DevicePidProfile
): Promise<MatterDeviceStatus> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<MatterDeviceStatus>(
      `${matterEndpoint}/${encodeURIComponent(device.deviceId)}/status`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch {
    return buildLocalMatterStatus(device, pidProfile);
  }
}

export async function requestMatterCommissioning(
  session: AuthSession,
  device: DeviceRecord,
  pidProfile: DevicePidProfile
): Promise<MatterPlaceholderActionResult> {
  const currentHome = getCurrentHome(session);
  const homeRole = getHomeRole(session);

  if (!canManageMatter(homeRole)) {
    throw new Error("Only owner or admin access can trigger Matter commissioning.");
  }

  try {
    return await fetchJson<MatterPlaceholderActionResult>(
      `${matterEndpoint}/${encodeURIComponent(device.deviceId)}/commission`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify({})
      }
    );
  } catch {
    const status = buildLocalMatterStatus(device, pidProfile);

    if (!status.activationEnabled) {
      throw new Error(status.activationMessage);
    }

    if (
      status.readiness !== "ready_to_commission" &&
      status.readiness !== "bridge_ready"
    ) {
      throw new Error(`Matter commissioning is not available for mode ${status.mode}.`);
    }

    const requestedAt = new Date().toISOString();
    saveDemoMatterRuntime(device.deviceId, {
      commissioningState: "requested",
      lastCommissioningAttemptAt: requestedAt
    });

    return {
      deviceId: device.deviceId,
      pid: pidProfile.pid,
      mode: status.mode,
      action: "commission",
      status: "accepted",
      placeholder: true,
      requestedAt,
      message:
        status.mode === "MATTER_BRIDGE_GATEWAY"
          ? "Matter gateway commissioning was staged as a placeholder. Live commissioner transport is not wired yet."
          : "Matter commissioning was staged as a placeholder. Live commissioner transport is not wired yet."
    };
  }
}

export async function requestMatterBridgeSync(
  session: AuthSession,
  device: DeviceRecord,
  pidProfile: DevicePidProfile
): Promise<MatterPlaceholderActionResult> {
  const currentHome = getCurrentHome(session);
  const homeRole = getHomeRole(session);

  if (!canManageMatter(homeRole)) {
    throw new Error("Only owner or admin access can trigger Matter bridge sync.");
  }

  try {
    return await fetchJson<MatterPlaceholderActionResult>(
      `${matterEndpoint}/${encodeURIComponent(device.deviceId)}/bridge-sync`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify({})
      }
    );
  } catch {
    const status = buildLocalMatterStatus(device, pidProfile);

    if (!status.activationEnabled) {
      throw new Error(status.activationMessage);
    }

    if (
      status.bridgeState !== "gateway_ready" &&
      status.bridgeState !== "child_waiting_for_gateway" &&
      status.bridgeState !== "sync_requested"
    ) {
      throw new Error(`Matter bridge sync is not available for mode ${status.mode}.`);
    }

    const requestedAt = new Date().toISOString();
    saveDemoMatterRuntime(device.deviceId, {
      bridgeState: "sync_requested",
      lastBridgeSyncAt: requestedAt
    });

    return {
      deviceId: device.deviceId,
      pid: pidProfile.pid,
      mode: status.mode,
      action: "bridge_sync",
      status: "accepted",
      placeholder: true,
      requestedAt,
      message:
        status.mode === "MATTER_BRIDGE_CHILD"
          ? "Matter bridge-child sync was staged as a placeholder. Live gateway routing is not wired yet."
          : "Matter bridge sync was staged as a placeholder. Live gateway coordination is not wired yet."
    };
  }
}

export const deviceManagementApiTesting = {
  reset() {
    resetDemoDevices();
    demoPidProfiles.clear();
    demoMatterRuntime.clear();
    demoFirmwareRollouts.clear();
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
  },
  seedDemoRollouts(deviceId: string, rollouts: DeviceFirmwareRollout[]) {
    setDemoRolloutStore(deviceId, rollouts);
  }
};
