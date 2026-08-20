import type { StartSessionInput, StopSessionInput, TriggerSource } from "./session.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readTriggerSource(body: Record<string, unknown>): TriggerSource | undefined {
  const value = body.triggerSource;
  return value === "schedule" || value === "manual" || value === "recovery" || value === "api"
    ? value
    : undefined;
}

function optionalProp<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseStartSessionInput(body: unknown): StartSessionInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const cameraId = readString(body, "cameraId");
  const destinationId = readString(body, "destinationId");

  if (!cameraId || !destinationId) {
    return null;
  }

  return {
    cameraId,
    destinationId,
    ...optionalProp("plannedStopAt", readString(body, "plannedStopAt")),
    ...optionalProp("triggerSource", readTriggerSource(body)),
    ...optionalProp("requestId", readString(body, "requestId"))
  };
}

export function parseStopSessionInput(body: unknown): StopSessionInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const sessionId = readString(body, "sessionId");
  if (!sessionId) {
    return null;
  }

  return {
    sessionId,
    ...optionalProp("reason", readString(body, "reason"))
  };
}
