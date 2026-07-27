import type { DeviceRecord } from "@jenix/shared";

import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { deviceRepository } from "../devices/device.model";
import type { DeviceRequestContext } from "../devices/device.types";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";

import {
  nurseCallRecordRepository,
  nurseCallRemoteRepository
} from "./nurse-call-receiver.model";
import type {
  NurseCallDeviceCommand,
  NurseCallRecord,
  NurseCallRemoteRecord,
  RaiseCallInput,
  SaveRemoteInput
} from "./nurse-call-receiver.types";
import { NurseCallReceiverModuleError } from "./nurse-call-receiver.types";

const restrictedNurseCallCommands = new Set<NurseCallDeviceCommand>(["factory_reset"]);

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveDeviceContext(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ device: DeviceRecord; context: DeviceRequestContext }> {
  let resolvedContext: DeviceRequestContext;

  try {
    resolvedContext = await resolveHomeAccessContext(context);
  } catch (error) {
    if (error instanceof HomeModuleError) {
      throw new NurseCallReceiverModuleError(error.statusCode, error.message);
    }

    throw error;
  }

  const device = await deviceRepository.get(normalizeDeviceId(deviceId));

  if (!device) {
    throw new NurseCallReceiverModuleError(
      404,
      `Device not found: ${normalizeDeviceId(deviceId)}`
    );
  }

  if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
    throw new NurseCallReceiverModuleError(403, "Device access denied");
  }

  if (
    !resolvedContext.homeRole &&
    resolvedContext.userId &&
    device.ownerUserId !== resolvedContext.userId
  ) {
    throw new NurseCallReceiverModuleError(403, "Device access denied");
  }

  return { device, context: resolvedContext };
}

export async function listRemotes(
  deviceId: string,
  context: DeviceRequestContext
): Promise<NurseCallRemoteRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return nurseCallRemoteRepository.listByDevice(device.deviceId);
}

export async function saveRemote(
  deviceId: string,
  input: SaveRemoteInput,
  context: DeviceRequestContext
): Promise<NurseCallRemoteRecord> {
  const { device } = await resolveDeviceContext(deviceId, context);
  const timestamp = new Date().toISOString();
  const record: NurseCallRemoteRecord = {
    remoteId: createId("remote"),
    deviceId: device.deviceId,
    name: input.name,
    remoteType: input.remoteType,
    learnedAt: timestamp,
    updatedAt: timestamp,
    ...(input.wardLabel ? { wardLabel: input.wardLabel } : {}),
    ...(input.roomLabel ? { roomLabel: input.roomLabel } : {}),
    ...(input.bedLabel ? { bedLabel: input.bedLabel } : {})
  };

  return nurseCallRemoteRepository.save(record);
}

export async function listActiveCalls(
  deviceId: string,
  context: DeviceRequestContext
): Promise<NurseCallRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return nurseCallRecordRepository.listByDevice(device.deviceId, "active");
}

export async function listCallHistory(
  deviceId: string,
  context: DeviceRequestContext
): Promise<NurseCallRecord[]> {
  const { device } = await resolveDeviceContext(deviceId, context);
  return nurseCallRecordRepository.listByDevice(device.deviceId, "attended");
}

/** Raises (or repeats) an active call — called from the device events MQTT ingress path. */
export async function raiseCall(
  deviceId: string,
  input: RaiseCallInput
): Promise<NurseCallRecord> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const activeCalls = await nurseCallRecordRepository.listByDevice(
    normalizedDeviceId,
    "active"
  );
  const existing = input.remoteId
    ? activeCalls.find((call) => call.remoteId === input.remoteId)
    : undefined;

  if (existing) {
    const repeated: NurseCallRecord = {
      ...existing,
      repeatCount: existing.repeatCount + 1
    };
    return nurseCallRecordRepository.save(repeated);
  }

  const record: NurseCallRecord = {
    callId: createId("call"),
    deviceId: normalizedDeviceId,
    status: "active",
    repeatCount: 1,
    raisedAt: input.occurredAt,
    ...(input.remoteId ? { remoteId: input.remoteId } : {}),
    ...(input.remoteName ? { remoteName: input.remoteName } : {}),
    ...(input.bedLabel ? { bedLabel: input.bedLabel } : {})
  };

  return nurseCallRecordRepository.save(record);
}

export async function attendCall(
  deviceId: string,
  callId: string,
  context: DeviceRequestContext
): Promise<NurseCallRecord> {
  const { device, context: resolvedContext } = await resolveDeviceContext(
    deviceId,
    context
  );
  const existing = await nurseCallRecordRepository.get(callId);

  if (!existing || existing.deviceId !== device.deviceId) {
    throw new NurseCallReceiverModuleError(404, `Call not found: ${callId}`);
  }

  if (existing.status === "attended") {
    throw new NurseCallReceiverModuleError(409, `Call already attended: ${callId}`);
  }

  const attended: NurseCallRecord = {
    ...existing,
    status: "attended",
    attendedAt: new Date().toISOString(),
    attendedBy: resolvedContext.userId ?? "unknown"
  };

  await nurseCallRecordRepository.save(attended);
  await dispatchCommand(device.deviceId, "attend_call", { callId }, context);

  return attended;
}

export async function dispatchCommand(
  deviceId: string,
  command: NurseCallDeviceCommand,
  payload: Record<string, unknown> | undefined,
  context: DeviceRequestContext
): Promise<{ dispatched: boolean }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(
    deviceId,
    context
  );

  if (
    restrictedNurseCallCommands.has(command) &&
    resolvedContext.homeRole !== "owner" &&
    resolvedContext.homeRole !== "admin"
  ) {
    throw new NurseCallReceiverModuleError(
      403,
      `Restricted command requires owner/admin access: ${command}`
    );
  }

  const bridge = getRuntimeMqttBridge();

  if (!bridge) {
    return { dispatched: false };
  }

  await bridge.publishDeviceCommand({
    deliveryId: createId("cmd"),
    runId: `nurse-call:${command}`,
    sceneId: `manual:${command}`,
    homeId: device.homeId,
    source: "manual",
    requestedAt: new Date().toISOString(),
    deviceId: device.deviceId,
    pid: device.pid,
    command,
    ...(payload ? { payload } : {})
  });

  return { dispatched: true };
}

export const nurseCallReceiverTesting = {
  reset() {
    return Promise.all([
      nurseCallRemoteRepository.reset(),
      nurseCallRecordRepository.reset()
    ]).then(() => undefined);
  }
};
