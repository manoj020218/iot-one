import { randomUUID } from "node:crypto";

import { getAudioAsset } from "../audio-assets/audio-asset.service";
import { announceToTarget } from "../announcements/announcement.service";
import { IP_SPEAKER_DEFAULT_TIMEZONE, isIpSpeakerPid } from "../constants";
import { getSpeakerGroup } from "../groups/group.service";
import type {
  IpSpeakerPlatformDeps,
  IpSpeakerRequestContext
} from "../platform-deps";
import { speakerScheduleRepository } from "./schedule.model";
import type {
  CreateSpeakerScheduleInput,
  ExecuteScheduleNowInput,
  SpeakerAnnouncementScheduleRecord,
  SpeakerScheduleExecutionRecord,
  UpdateSpeakerScheduleInput
} from "./schedule.types";
import { SpeakerScheduleError } from "./schedule.types";

function assertValidLocalTime(localTime: string): void {
  if (!/^\d{2}:\d{2}$/.test(localTime)) {
    throw new SpeakerScheduleError(400, "localTime must be HH:MM");
  }

  const [hoursRaw, minutesRaw] = localTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new SpeakerScheduleError(400, "localTime must be a valid 24-hour time");
  }

  if (hours > 23 || minutes > 59) {
    throw new SpeakerScheduleError(400, "localTime must be a valid 24-hour time");
  }
}

function assertValidDate(date: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new SpeakerScheduleError(400, `${label} must be YYYY-MM-DD`);
  }
}

async function assertScheduleTarget(
  deps: IpSpeakerPlatformDeps,
  context: IpSpeakerRequestContext,
  targetKind: "device" | "group",
  targetId: string
): Promise<void> {
  if (targetKind === "device") {
    const device = await deps.getDevice(targetId, context);
    if (!isIpSpeakerPid(device.pid)) {
      throw new SpeakerScheduleError(400, `Not an IP Speaker device: ${targetId}`);
    }
    return;
  }

  if (!context.homeId) {
    throw new SpeakerScheduleError(400, "Home context is required for group schedules");
  }

  await getSpeakerGroup(targetId, context.homeId);
}

async function assertScheduleSource(
  homeId: string,
  source: SpeakerAnnouncementScheduleRecord["source"]
): Promise<void> {
  if (source.sourceType === "audio_asset") {
    await getAudioAsset(source.audioId, homeId);
    return;
  }

  if (source.sourceType === "url") {
    const url = new URL(source.sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new SpeakerScheduleError(400, "Only http/https schedule URLs are allowed");
    }
    return;
  }

  if (source.durationSeconds !== undefined && source.durationSeconds <= 0) {
    throw new SpeakerScheduleError(400, "Tone durationSeconds must be positive");
  }
}

function assertScheduleShape(record: {
  localTime: string;
  daysOfWeek: string[];
  startDate: string | null;
  endDate: string | null;
}): void {
  assertValidLocalTime(record.localTime);

  if (record.daysOfWeek.length === 0 && !record.startDate) {
    throw new SpeakerScheduleError(
      400,
      "One-time schedules require startDate when daysOfWeek is empty"
    );
  }

  if (record.startDate) {
    assertValidDate(record.startDate, "startDate");
  }

  if (record.endDate) {
    assertValidDate(record.endDate, "endDate");
  }

  if (record.startDate && record.endDate && record.endDate < record.startDate) {
    throw new SpeakerScheduleError(400, "endDate must not be earlier than startDate");
  }
}

export function listSpeakerSchedules(
  homeId: string
): Promise<SpeakerAnnouncementScheduleRecord[]> {
  return speakerScheduleRepository.listByHome(homeId);
}

export async function getSpeakerSchedule(
  scheduleId: string,
  homeId: string
): Promise<SpeakerAnnouncementScheduleRecord> {
  const record = await speakerScheduleRepository.getSchedule(scheduleId.trim());
  if (!record || record.homeId !== homeId) {
    throw new SpeakerScheduleError(404, `Speaker schedule not found: ${scheduleId.trim()}`);
  }
  return record;
}

export async function createSpeakerSchedule(
  deps: IpSpeakerPlatformDeps,
  context: IpSpeakerRequestContext,
  input: CreateSpeakerScheduleInput
): Promise<SpeakerAnnouncementScheduleRecord> {
  if (!context.homeId || !context.userId) {
    throw new SpeakerScheduleError(400, "Authenticated home context is required");
  }

  assertScheduleShape({
    localTime: input.localTime,
    daysOfWeek: input.daysOfWeek,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null
  });
  await assertScheduleTarget(deps, context, input.targetKind, input.targetId);
  await assertScheduleSource(context.homeId, input.source);

  const now = new Date().toISOString();
  const record: SpeakerAnnouncementScheduleRecord = {
    scheduleId: `SCH-${randomUUID().slice(0, 8).toUpperCase()}`,
    homeId: context.homeId,
    name: input.name,
    targetKind: input.targetKind,
    targetId: input.targetId,
    source: input.source,
    timezone: input.timezone ?? IP_SPEAKER_DEFAULT_TIMEZONE,
    localTime: input.localTime,
    daysOfWeek: input.daysOfWeek,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    enabled: input.enabled ?? true,
    priority: input.priority ?? 0,
    volumeOverridePercent: input.volumeOverridePercent ?? null,
    createdByUserId: context.userId,
    createdAt: now,
    updatedAt: now
  };

  return speakerScheduleRepository.saveSchedule(record);
}

export async function updateSpeakerSchedule(
  deps: IpSpeakerPlatformDeps,
  scheduleId: string,
  context: IpSpeakerRequestContext,
  input: UpdateSpeakerScheduleInput
): Promise<SpeakerAnnouncementScheduleRecord> {
  if (!context.homeId) {
    throw new SpeakerScheduleError(400, "Home context is required");
  }

  const existing = await getSpeakerSchedule(scheduleId, context.homeId);
  const updated: SpeakerAnnouncementScheduleRecord = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.targetKind !== undefined ? { targetKind: input.targetKind } : {}),
    ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.localTime !== undefined ? { localTime: input.localTime } : {}),
    ...(input.daysOfWeek !== undefined ? { daysOfWeek: input.daysOfWeek } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate ?? null } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate ?? null } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.volumeOverridePercent !== undefined
      ? { volumeOverridePercent: input.volumeOverridePercent ?? null }
      : {}),
    updatedAt: new Date().toISOString()
  };

  assertScheduleShape(updated);
  await assertScheduleTarget(deps, context, updated.targetKind, updated.targetId);
  await assertScheduleSource(context.homeId, updated.source);

  return speakerScheduleRepository.saveSchedule(updated);
}

export async function listSpeakerScheduleExecutions(
  scheduleId: string,
  homeId: string
): Promise<SpeakerScheduleExecutionRecord[]> {
  await getSpeakerSchedule(scheduleId, homeId);
  return speakerScheduleRepository.listExecutionsBySchedule(scheduleId);
}

export async function executeSpeakerScheduleNow(
  deps: IpSpeakerPlatformDeps,
  scheduleId: string,
  context: IpSpeakerRequestContext,
  input: ExecuteScheduleNowInput
) {
  if (!context.homeId) {
    throw new SpeakerScheduleError(400, "Home context is required");
  }

  const schedule = await getSpeakerSchedule(scheduleId, context.homeId);
  if (input.executionKey) {
    const isDuplicate = await speakerScheduleRepository.hasExecutionKey(
      schedule.scheduleId,
      input.executionKey
    );
    if (isDuplicate) {
      throw new SpeakerScheduleError(
        409,
        `Schedule execution already recorded for key: ${input.executionKey}`
      );
    }
  }

  const requestedByUserId = context.userId ?? schedule.createdByUserId;
  const announcement = await announceToTarget(
    deps,
    schedule.targetKind,
    schedule.targetId,
    { ...context, userId: requestedByUserId, homeId: schedule.homeId },
    {
      source: schedule.source,
      priority: schedule.priority,
      ...(schedule.volumeOverridePercent !== null
        ? { volumePercent: schedule.volumeOverridePercent }
        : {})
    }
  );

  const execution: SpeakerScheduleExecutionRecord = {
    eventId: `EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
    scheduleId: schedule.scheduleId,
    homeId: schedule.homeId,
    targetKind: schedule.targetKind,
    targetId: schedule.targetId,
    requestedByUserId,
    executedAt: new Date().toISOString(),
    acceptedDevices: announcement.summary.accepted,
    failedDevices: announcement.summary.failed,
    executionKey: input.executionKey ?? null
  };

  return {
    execution: await speakerScheduleRepository.saveExecution(execution),
    dispatch: announcement
  };
}

export const scheduleTesting = {
  reset: () => speakerScheduleRepository.reset()
};
