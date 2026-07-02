import type { ProductPidRecord } from "@jenix/device-schemas";
import type {
  MatterDeviceStatus,
  MatterMappingSummary,
  MatterPlaceholderActionResult,
  MatterReadinessState
} from "@jenix/shared";

import { getDevice } from "../devices/device.service";
import { getPid } from "../pid/pid.service";
import { matterRuntimeRepository } from "./matter.model";
import type { MatterRequestContext, MatterRuntimeRecord } from "./matter.types";
import { MatterModuleError } from "./matter.types";

function isMatterRuntimeEnabled(): boolean {
  return process.env.MATTER_RUNTIME_ENABLED?.trim() === "true";
}

function getMatterActivationMessage(): string {
  return isMatterRuntimeEnabled()
    ? "Matter runtime is enabled for this deployment."
    : "Matter remains planned at the MQTT/VPS layer only until multi-product rollout, vendor ID assignment, and CSA readiness are complete.";
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createMapping(pid: ProductPidRecord): MatterMappingSummary {
  return {
    endpoints: clone(pid.matter.endpoints ?? []),
    clusters: [...(pid.matter.clusters ?? [])],
    bridgeSupported: pid.matter.bridgeSupported,
    ...(pid.matter.deviceType ? { deviceType: pid.matter.deviceType } : {}),
    ...(pid.matter.vendorId ? { vendorId: pid.matter.vendorId } : {}),
    ...(pid.matter.productId ? { productId: pid.matter.productId } : {}),
    ...(pid.matter.discriminator ? { discriminator: pid.matter.discriminator } : {}),
    ...(pid.matter.certificationStatus
      ? { certificationStatus: pid.matter.certificationStatus }
      : {})
  };
}

function requireMatterOperatorAccess(
  ownerUserId: string,
  context: MatterRequestContext
) {
  if (context.homeRole === "owner" || context.homeRole === "admin") {
    return;
  }

  if (!context.homeRole && context.userId && context.userId === ownerUserId) {
    return;
  }

  throw new MatterModuleError(
    403,
    "Matter commissioning and bridge sync require owner/admin access"
  );
}

function buildStatus(
  pid: ProductPidRecord,
  deviceMatterEnabled: boolean,
  runtime: MatterRuntimeRecord | undefined
): Omit<MatterDeviceStatus, "deviceId" | "pid"> {
  const activationEnabled = isMatterRuntimeEnabled();
  const activationMessage = getMatterActivationMessage();
  const notes: string[] = [];
  const mode = pid.matter.mode;
  const hardwareMatterCapable = pid.hardware.hasMatter;
  const mapping = createMapping(pid);
  let readiness: MatterReadinessState;
  let commissioningState: MatterDeviceStatus["commissioningState"];
  let bridgeState: MatterDeviceStatus["bridgeState"];
  let enabled = false;

  if (!pid.matter.enabled || mode === "NONE") {
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
    enabled,
    activationEnabled,
    activationMessage,
    deviceMatterEnabled,
    hardwareMatterCapable,
    mode,
    readiness,
    commissioningState,
    bridgeState,
    mapping,
    notes,
    ...(runtime?.lastCommissioningAttemptAt
      ? { lastCommissioningAttemptAt: runtime.lastCommissioningAttemptAt }
      : {}),
    ...(runtime?.lastBridgeSyncAt
      ? { lastBridgeSyncAt: runtime.lastBridgeSyncAt }
      : {})
  };
}

function getMatterStateRecord(deviceId: string): MatterRuntimeRecord | undefined {
  return matterRuntimeRepository.get(deviceId);
}

export function getMatterDeviceStatus(
  deviceId: string,
  context: MatterRequestContext
): Promise<MatterDeviceStatus> {
  return getDevice(deviceId, context).then(async (device) => {
    const pid = await getPid(device.pid);
    const runtime = getMatterStateRecord(device.deviceId);
    const deviceMatterEnabled = device.matterEnabled ?? pid.matter.enabled;

    return {
      deviceId: device.deviceId,
      pid: pid.pid,
      ...buildStatus(pid, deviceMatterEnabled, runtime)
    };
  });
}

export async function requestMatterCommissioning(
  deviceId: string,
  context: MatterRequestContext
): Promise<MatterPlaceholderActionResult> {
  const device = await getDevice(deviceId, context);
  requireMatterOperatorAccess(device.ownerUserId, context);

  const status = await getMatterDeviceStatus(device.deviceId, context);

  if (!status.activationEnabled) {
    throw new MatterModuleError(409, status.activationMessage);
  }

  if (
    status.readiness !== "ready_to_commission" &&
    status.readiness !== "bridge_ready"
  ) {
    throw new MatterModuleError(
      409,
      `Matter commissioning is not available for mode ${status.mode}`
    );
  }

  const requestedAt = new Date().toISOString();
  const runtime = matterRuntimeRepository.save({
    ...(getMatterStateRecord(device.deviceId) ?? { deviceId: device.deviceId }),
    deviceId: device.deviceId,
    commissioningState: "requested",
    lastCommissioningAttemptAt: requestedAt
  });

  return {
    deviceId: device.deviceId,
    pid: status.pid,
    mode: status.mode,
    action: "commission",
    status: "accepted",
    placeholder: true,
    requestedAt: runtime.lastCommissioningAttemptAt ?? requestedAt,
    message:
      status.mode === "MATTER_BRIDGE_GATEWAY"
        ? "Matter gateway commissioning was staged as a placeholder. Live commissioner transport is not wired yet."
        : "Matter commissioning was staged as a placeholder. Live commissioner transport is not wired yet."
  };
}

export async function requestMatterBridgeSync(
  deviceId: string,
  context: MatterRequestContext
): Promise<MatterPlaceholderActionResult> {
  const device = await getDevice(deviceId, context);
  requireMatterOperatorAccess(device.ownerUserId, context);

  const status = await getMatterDeviceStatus(device.deviceId, context);

  if (!status.activationEnabled) {
    throw new MatterModuleError(409, status.activationMessage);
  }

  if (
    status.bridgeState !== "gateway_ready" &&
    status.bridgeState !== "child_waiting_for_gateway" &&
    status.bridgeState !== "sync_requested"
  ) {
    throw new MatterModuleError(
      409,
      `Matter bridge sync is not available for mode ${status.mode}`
    );
  }

  const requestedAt = new Date().toISOString();
  const runtime = matterRuntimeRepository.save({
    ...(getMatterStateRecord(device.deviceId) ?? { deviceId: device.deviceId }),
    deviceId: device.deviceId,
    bridgeState: "sync_requested",
    lastBridgeSyncAt: requestedAt
  });

  return {
    deviceId: device.deviceId,
    pid: status.pid,
    mode: status.mode,
    action: "bridge_sync",
    status: "accepted",
    placeholder: true,
    requestedAt: runtime.lastBridgeSyncAt ?? requestedAt,
    message:
      status.mode === "MATTER_BRIDGE_CHILD"
        ? "Matter bridge-child sync was staged as a placeholder. Live gateway routing is not wired yet."
        : "Matter bridge sync was staged as a placeholder. Live gateway coordination is not wired yet."
  };
}

export const matterTesting = {
  reset() {
    matterRuntimeRepository.reset();
  }
};
