/**
 * Every Smart Streamer schedule is stored here as ONE PWA-facing record
 * (this is the source of truth for name/device/camera/destination/
 * priority/enabled) and projected into a PAIR of Scenes for the actual
 * server-side triggering (one "start_stream" schedule-trigger Scene, one
 * "stop_stream" one) — see SCHEDULE.md and VPS/API_CONTRACT.md §4 for why
 * this couldn't be a single Scene (SceneSchedule is one fire-time, not a
 * window) and why overlap validation has to live here (Scenes doesn't
 * provide it). The Scene pair is never read back to reconstruct state —
 * this record is authoritative; the Scenes exist purely to fire on time.
 */
import { randomUUID } from "node:crypto";

import { getCamera } from "../cameras/camera.service";
import { getDestination } from "../destinations/destination.service";
import type { SceneRequestContext, SmartStreamerPlatformDeps } from "../platform-deps";
import { scheduleRepository } from "./schedule.model";
import type {
  CreateScheduleInput,
  StreamerScheduleRecord,
  StreamerScheduleSummary,
  UpdateScheduleInput,
  WeekdayCode
} from "./schedule.types";
import { StreamerScheduleError, WEEKDAY_ORDER } from "./schedule.types";

function createScheduleId(): string {
  return `SCH-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toSummary(record: StreamerScheduleRecord): StreamerScheduleSummary {
  const { startSceneId: _startSceneId, stopSceneId: _stopSceneId, ...summary } = record;
  return summary;
}

function toDayNumbers(days: WeekdayCode[]): number[] {
  return days.map((day) => WEEKDAY_ORDER.indexOf(day));
}

async function requireSchedule(
  scheduleId: string,
  homeId: string
): Promise<StreamerScheduleRecord> {
  const record = await scheduleRepository.get(scheduleId);

  if (!record || record.homeId !== homeId) {
    throw new StreamerScheduleError(404, "SCHEDULE_NOT_FOUND", `Schedule not found: ${scheduleId}`);
  }

  return record;
}

// Time-range overlap only (HH:MM, same timezone) — does not handle
// overnight windows (stop < start) or cross-timezone comparison, both
// honestly out of scope for this pass. Date-range (startDate/endDate)
// overlap is checked when both schedules declare one; an indefinite
// schedule (no dates) is treated as always in range.
function timeRangesOverlap(aStart: string, aStop: string, bStart: string, bStop: string): boolean {
  return aStart < bStop && bStart < aStop;
}

function dateRangesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null
): boolean {
  if ((aStart && bEnd && aStart > bEnd) || (aEnd && bStart && aEnd < bStart)) {
    return false;
  }
  return true;
}

async function assertNoOverlap(
  deviceId: string,
  candidate: Pick<StreamerScheduleRecord, "startLocalTime" | "stopLocalTime" | "daysOfWeek" | "startDate" | "endDate">,
  excludeScheduleId: string | null
): Promise<void> {
  const existing = (await scheduleRepository.listByDevice(deviceId)).filter(
    (schedule) => schedule.scheduleId !== excludeScheduleId && schedule.enabled
  );

  for (const other of existing) {
    const sharesDay = candidate.daysOfWeek.some((day) => other.daysOfWeek.includes(day));
    if (!sharesDay) {
      continue;
    }
    if (!dateRangesOverlap(candidate.startDate, candidate.endDate, other.startDate, other.endDate)) {
      continue;
    }
    if (
      timeRangesOverlap(candidate.startLocalTime, candidate.stopLocalTime, other.startLocalTime, other.stopLocalTime)
    ) {
      throw new StreamerScheduleError(
        409,
        "SCHEDULE_CONFLICT",
        `This device is already scheduled (${other.name}) from ${other.startLocalTime} to ${other.stopLocalTime}.`
      );
    }
  }
}

async function createScenePair(
  deps: SmartStreamerPlatformDeps,
  input: CreateScheduleInput,
  timezone: string,
  context: SceneRequestContext
): Promise<{ startSceneId: string; stopSceneId: string }> {
  const days = toDayNumbers(input.daysOfWeek);

  const startScene = await deps.createScene(
    {
      name: `Smart Streamer: ${input.name} (start)`,
      triggers: [{ type: "schedule" }],
      conditions: [],
      actions: [
        {
          type: "device_command",
          deviceId: input.deviceId,
          command: "start_stream",
          payload: { cameraId: input.cameraId, destinationId: input.destinationId }
        }
      ],
      schedule: { timezone, daysOfWeek: days, time: input.startLocalTime }
    },
    context
  );

  const stopScene = await deps.createScene(
    {
      name: `Smart Streamer: ${input.name} (stop)`,
      triggers: [{ type: "schedule" }],
      conditions: [],
      actions: [{ type: "device_command", deviceId: input.deviceId, command: "stop_stream" }],
      schedule: { timezone, daysOfWeek: days, time: input.stopLocalTime }
    },
    context
  );

  return { startSceneId: startScene.sceneId, stopSceneId: stopScene.sceneId };
}

export async function listSchedules(homeId: string): Promise<StreamerScheduleSummary[]> {
  return (await scheduleRepository.listByHome(homeId)).map(toSummary);
}

export async function getSchedule(scheduleId: string, homeId: string): Promise<StreamerScheduleSummary> {
  return toSummary(await requireSchedule(scheduleId, homeId));
}

export async function createSchedule(
  deps: SmartStreamerPlatformDeps,
  homeId: string,
  input: CreateScheduleInput,
  context: SceneRequestContext
): Promise<StreamerScheduleSummary> {
  await getCamera(input.cameraId, homeId);
  await getDestination(input.destinationId, homeId);

  const timezone = input.timezone ?? "Asia/Kolkata";
  const enabled = input.enabled ?? true;

  // A disabled schedule can never fire, so it can't actually conflict
  // with anything — skip the check rather than block e.g. duplicating an
  // active schedule as a disabled draft.
  if (enabled) {
    await assertNoOverlap(
      input.deviceId,
      {
        startLocalTime: input.startLocalTime,
        stopLocalTime: input.stopLocalTime,
        daysOfWeek: input.daysOfWeek,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null
      },
      null
    );
  }

  const { startSceneId, stopSceneId } = await createScenePair(deps, input, timezone, context);

  const now = new Date().toISOString();
  const record: StreamerScheduleRecord = {
    scheduleId: createScheduleId(),
    homeId,
    name: input.name,
    deviceId: input.deviceId,
    cameraId: input.cameraId,
    destinationId: input.destinationId,
    timezone,
    startLocalTime: input.startLocalTime,
    stopLocalTime: input.stopLocalTime,
    daysOfWeek: input.daysOfWeek,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    enabled,
    priority: input.priority ?? 1,
    startSceneId,
    stopSceneId,
    createdAt: now,
    updatedAt: now
  };

  return toSummary(await scheduleRepository.save(record));
}

export async function deleteSchedule(
  deps: SmartStreamerPlatformDeps,
  scheduleId: string,
  homeId: string,
  context: SceneRequestContext
): Promise<void> {
  const existing = await requireSchedule(scheduleId, homeId);

  await deps.deleteScene(existing.startSceneId, context);
  await deps.deleteScene(existing.stopSceneId, context);
  await scheduleRepository.remove(scheduleId);
}

export async function updateSchedule(
  deps: SmartStreamerPlatformDeps,
  scheduleId: string,
  homeId: string,
  input: UpdateScheduleInput,
  context: SceneRequestContext
): Promise<StreamerScheduleSummary> {
  const existing = await requireSchedule(scheduleId, homeId);

  const merged: StreamerScheduleRecord = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.cameraId !== undefined ? { cameraId: input.cameraId } : {}),
    ...(input.destinationId !== undefined ? { destinationId: input.destinationId } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.startLocalTime !== undefined ? { startLocalTime: input.startLocalTime } : {}),
    ...(input.stopLocalTime !== undefined ? { stopLocalTime: input.stopLocalTime } : {}),
    ...(input.daysOfWeek !== undefined ? { daysOfWeek: input.daysOfWeek } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    updatedAt: new Date().toISOString()
  };

  // Same reasoning as createSchedule: a schedule being disabled by this
  // same update can't conflict with anything, since it can't fire.
  if (merged.enabled) {
    await assertNoOverlap(
      merged.deviceId,
      {
        startLocalTime: merged.startLocalTime,
        stopLocalTime: merged.stopLocalTime,
        daysOfWeek: merged.daysOfWeek,
        startDate: merged.startDate,
        endDate: merged.endDate
      },
      merged.scheduleId
    );
  }

  const days = toDayNumbers(merged.daysOfWeek);
  await deps.patchScene(
    existing.startSceneId,
    {
      ...(input.name !== undefined ? { name: `Smart Streamer: ${merged.name} (start)` } : {}),
      status: merged.enabled ? "active" : "paused",
      schedule: { timezone: merged.timezone, daysOfWeek: days, time: merged.startLocalTime },
      actions: [
        {
          type: "device_command",
          deviceId: merged.deviceId,
          command: "start_stream",
          payload: { cameraId: merged.cameraId, destinationId: merged.destinationId }
        }
      ]
    },
    context
  );
  await deps.patchScene(
    existing.stopSceneId,
    {
      ...(input.name !== undefined ? { name: `Smart Streamer: ${merged.name} (stop)` } : {}),
      status: merged.enabled ? "active" : "paused",
      schedule: { timezone: merged.timezone, daysOfWeek: days, time: merged.stopLocalTime }
    },
    context
  );

  return toSummary(await scheduleRepository.save(merged));
}

export async function duplicateSchedule(
  deps: SmartStreamerPlatformDeps,
  scheduleId: string,
  homeId: string,
  context: SceneRequestContext
): Promise<StreamerScheduleSummary> {
  const existing = await requireSchedule(scheduleId, homeId);

  return createSchedule(
    deps,
    homeId,
    {
      name: `${existing.name} (copy)`,
      deviceId: existing.deviceId,
      cameraId: existing.cameraId,
      destinationId: existing.destinationId,
      timezone: existing.timezone,
      startLocalTime: existing.startLocalTime,
      stopLocalTime: existing.stopLocalTime,
      daysOfWeek: existing.daysOfWeek,
      ...(existing.startDate ? { startDate: existing.startDate } : {}),
      ...(existing.endDate ? { endDate: existing.endDate } : {}),
      enabled: false,
      priority: existing.priority
    },
    context
  );
}

export async function runScheduleNow(
  deps: SmartStreamerPlatformDeps,
  scheduleId: string,
  homeId: string,
  context: SceneRequestContext
): Promise<void> {
  const existing = await requireSchedule(scheduleId, homeId);
  await deps.runSceneManually(existing.startSceneId, {}, context);
}
