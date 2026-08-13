import type { SpeakerAnnouncementSourceInput } from "../announcements/announcement.types";
import type {
  CreateSpeakerScheduleInput,
  ExecuteScheduleNowInput,
  SpeakerScheduleTargetKind,
  UpdateSpeakerScheduleInput,
  WeekdayCode
} from "./schedule.types";

const WEEKDAY_CODES: WeekdayCode[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  return typeof value === "boolean" ? value : undefined;
}

function readPriority(body: Record<string, unknown>): 0 | 1 | 2 | undefined {
  const value = body.priority;
  return value === 0 || value === 1 || value === 2 ? value : undefined;
}

function readTargetKind(
  body: Record<string, unknown>
): SpeakerScheduleTargetKind | undefined {
  const value = body.targetKind;
  return value === "device" || value === "group" ? value : undefined;
}

function readDaysOfWeek(body: Record<string, unknown>): WeekdayCode[] | undefined {
  const value = body.daysOfWeek;
  if (!Array.isArray(value)) {
    return undefined;
  }

  const days = [...new Set(value)]
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is WeekdayCode => WEEKDAY_CODES.includes(entry as WeekdayCode));

  return days;
}

function readVolumeOverridePercent(
  body: Record<string, unknown>
): number | undefined {
  const value = readNumber(body, "volumeOverridePercent");
  return value !== undefined && value >= 0 && value <= 100 ? value : undefined;
}

function parseSource(body: Record<string, unknown>): SpeakerAnnouncementSourceInput | null {
  const source = body.source;
  if (!isRecord(source)) {
    return null;
  }

  const sourceType = readString(source, "sourceType");
  if (sourceType === "audio_asset") {
    const audioId = readString(source, "audioId");
    return audioId ? { sourceType, audioId } : null;
  }

  if (sourceType === "url") {
    const sourceUrl = readString(source, "sourceUrl");
    const title = readString(source, "title");
    return sourceUrl ? { sourceType, sourceUrl, ...(title ? { title } : {}) } : null;
  }

  if (sourceType === "tone") {
    const toneKey = readString(source, "toneKey");
    const durationSeconds = readNumber(source, "durationSeconds");
    return toneKey
      ? {
          sourceType,
          toneKey,
          ...(durationSeconds !== undefined ? { durationSeconds } : {})
        }
      : null;
  }

  return null;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseCreateSpeakerScheduleInput(
  body: unknown
): CreateSpeakerScheduleInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const name = readString(body, "name");
  const targetKind = readTargetKind(body);
  const targetId = readString(body, "targetId");
  const source = parseSource(body);
  const localTime = readString(body, "localTime");

  if (!name || !targetKind || !targetId || !source || !localTime) {
    return null;
  }

  return {
    name,
    targetKind,
    targetId,
    source,
    localTime,
    daysOfWeek: readDaysOfWeek(body) ?? [],
    ...optionalProp("timezone", readString(body, "timezone")),
    ...optionalProp("startDate", readString(body, "startDate")),
    ...optionalProp("endDate", readString(body, "endDate")),
    ...optionalProp("enabled", readBoolean(body, "enabled")),
    ...optionalProp("priority", readPriority(body)),
    ...optionalProp("volumeOverridePercent", readVolumeOverridePercent(body))
  };
}

export function parseUpdateSpeakerScheduleInput(
  body: unknown
): UpdateSpeakerScheduleInput | null {
  if (!isRecord(body)) {
    return null;
  }

  return {
    ...optionalProp("name", readString(body, "name")),
    ...optionalProp("targetKind", readTargetKind(body)),
    ...optionalProp("targetId", readString(body, "targetId")),
    ...(body.source !== undefined
      ? (() => {
          const source = parseSource(body);
          return source ? { source } : {};
        })()
      : {}),
    ...optionalProp("timezone", readString(body, "timezone")),
    ...optionalProp("localTime", readString(body, "localTime")),
    ...(body.daysOfWeek !== undefined
      ? { daysOfWeek: readDaysOfWeek(body) ?? [] }
      : {}),
    ...optionalProp("startDate", readString(body, "startDate")),
    ...optionalProp("endDate", readString(body, "endDate")),
    ...optionalProp("enabled", readBoolean(body, "enabled")),
    ...optionalProp("priority", readPriority(body)),
    ...optionalProp("volumeOverridePercent", readVolumeOverridePercent(body))
  };
}

export function parseExecuteScheduleNowInput(body: unknown): ExecuteScheduleNowInput {
  if (!isRecord(body)) {
    return {};
  }

  const executionKey = readString(body, "executionKey");
  return executionKey ? { executionKey } : {};
}
