import { randomUUID } from "node:crypto";

import type { DeviceRecord } from "@jenix/shared";

import { isIpSpeakerPid } from "../constants";
import type {
  IpSpeakerPlatformDeps,
  IpSpeakerRequestContext
} from "../platform-deps";
import { speakerGroupRepository } from "./group.model";
import type {
  CreateSpeakerGroupInput,
  SpeakerGroupRecord,
  UpdateSpeakerGroupInput
} from "./group.types";
import { SpeakerGroupError } from "./group.types";

function normalizeDeviceIds(deviceIds: string[]): string[] {
  return [...new Set(deviceIds.map((deviceId) => deviceId.trim()).filter(Boolean))];
}

async function requireSpeakerDevice(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext
): Promise<DeviceRecord> {
  const device = await deps.getDevice(deviceId, context);

  if (!isIpSpeakerPid(device.pid)) {
    throw new SpeakerGroupError(400, `Not an IP Speaker device: ${deviceId}`);
  }

  if (context.homeId && device.homeId !== context.homeId) {
    throw new SpeakerGroupError(403, `Device does not belong to home: ${deviceId}`);
  }

  return device;
}

async function validateSpeakerDeviceIds(
  deps: IpSpeakerPlatformDeps,
  deviceIds: string[],
  context: IpSpeakerRequestContext
): Promise<string[]> {
  const normalized = normalizeDeviceIds(deviceIds);
  if (normalized.length === 0) {
    throw new SpeakerGroupError(400, "At least one speaker device is required");
  }

  await Promise.all(
    normalized.map((deviceId) => requireSpeakerDevice(deps, deviceId, context))
  );

  return normalized;
}

export function listSpeakerGroups(homeId: string): Promise<SpeakerGroupRecord[]> {
  return speakerGroupRepository.listByHome(homeId);
}

export async function getSpeakerGroup(
  groupId: string,
  homeId: string
): Promise<SpeakerGroupRecord> {
  const group = await speakerGroupRepository.get(groupId.trim());
  if (!group || group.homeId !== homeId) {
    throw new SpeakerGroupError(404, `Speaker group not found: ${groupId.trim()}`);
  }
  return group;
}

export async function createSpeakerGroup(
  deps: IpSpeakerPlatformDeps,
  context: IpSpeakerRequestContext,
  input: CreateSpeakerGroupInput
): Promise<SpeakerGroupRecord> {
  if (!context.homeId || !context.userId) {
    throw new SpeakerGroupError(400, "Authenticated home context is required");
  }

  const now = new Date().toISOString();
  const record: SpeakerGroupRecord = {
    groupId: `GRP-${randomUUID().slice(0, 8).toUpperCase()}`,
    homeId: context.homeId,
    name: input.name,
    description: input.description ?? null,
    deviceIds: await validateSpeakerDeviceIds(deps, input.deviceIds, context),
    createdByUserId: context.userId,
    createdAt: now,
    updatedAt: now
  };

  return speakerGroupRepository.save(record);
}

export async function updateSpeakerGroup(
  deps: IpSpeakerPlatformDeps,
  groupId: string,
  context: IpSpeakerRequestContext,
  input: UpdateSpeakerGroupInput
): Promise<SpeakerGroupRecord> {
  if (!context.homeId) {
    throw new SpeakerGroupError(400, "Home context is required");
  }

  const existing = await getSpeakerGroup(groupId, context.homeId);
  const updated: SpeakerGroupRecord = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined
      ? { description: input.description ?? null }
      : {}),
    ...(input.deviceIds !== undefined
      ? {
          deviceIds: await validateSpeakerDeviceIds(deps, input.deviceIds, context)
        }
      : {}),
    updatedAt: new Date().toISOString()
  };

  return speakerGroupRepository.save(updated);
}

export const groupTesting = {
  reset: () => speakerGroupRepository.reset()
};
