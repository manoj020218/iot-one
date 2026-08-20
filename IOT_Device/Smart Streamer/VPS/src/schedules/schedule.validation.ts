import type { CreateScheduleInput, UpdateScheduleInput, WeekdayCode } from "./schedule.types";
import { WEEKDAY_ORDER } from "./schedule.types";

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

function readDaysOfWeek(body: Record<string, unknown>): WeekdayCode[] | undefined {
  const value = body.daysOfWeek;
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const days = value.filter((day): day is WeekdayCode =>
    typeof day === "string" && WEEKDAY_ORDER.includes(day as WeekdayCode)
  );

  return days.length === value.length ? days : undefined;
}

function isValidLocalTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function optionalProp<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseCreateScheduleInput(body: unknown): CreateScheduleInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const name = readString(body, "name");
  const deviceId = readString(body, "deviceId");
  const cameraId = readString(body, "cameraId");
  const destinationId = readString(body, "destinationId");
  const startLocalTime = readString(body, "startLocalTime");
  const stopLocalTime = readString(body, "stopLocalTime");
  const daysOfWeek = readDaysOfWeek(body);

  if (
    !name ||
    !deviceId ||
    !cameraId ||
    !destinationId ||
    !startLocalTime ||
    !stopLocalTime ||
    !daysOfWeek ||
    !isValidLocalTime(startLocalTime) ||
    !isValidLocalTime(stopLocalTime)
  ) {
    return null;
  }

  return {
    name,
    deviceId,
    cameraId,
    destinationId,
    startLocalTime,
    stopLocalTime,
    daysOfWeek,
    ...optionalProp("timezone", readString(body, "timezone")),
    ...optionalProp("startDate", readString(body, "startDate")),
    ...optionalProp("endDate", readString(body, "endDate")),
    ...optionalProp("enabled", readBoolean(body, "enabled")),
    ...optionalProp("priority", readNumber(body, "priority"))
  };
}

export function parseUpdateScheduleInput(body: unknown): UpdateScheduleInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const startLocalTime = readString(body, "startLocalTime");
  const stopLocalTime = readString(body, "stopLocalTime");

  if (
    (startLocalTime && !isValidLocalTime(startLocalTime)) ||
    (stopLocalTime && !isValidLocalTime(stopLocalTime))
  ) {
    return null;
  }

  return {
    ...optionalProp("name", readString(body, "name")),
    ...optionalProp("deviceId", readString(body, "deviceId")),
    ...optionalProp("cameraId", readString(body, "cameraId")),
    ...optionalProp("destinationId", readString(body, "destinationId")),
    ...optionalProp("timezone", readString(body, "timezone")),
    ...optionalProp("startLocalTime", startLocalTime),
    ...optionalProp("stopLocalTime", stopLocalTime),
    ...optionalProp("daysOfWeek", readDaysOfWeek(body)),
    ...optionalProp("startDate", readString(body, "startDate")),
    ...optionalProp("endDate", readString(body, "endDate")),
    ...optionalProp("enabled", readBoolean(body, "enabled")),
    ...optionalProp("priority", readNumber(body, "priority"))
  };
}
