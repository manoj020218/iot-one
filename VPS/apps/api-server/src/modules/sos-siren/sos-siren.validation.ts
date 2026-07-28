export interface SosSirenValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface SosSirenValidationFailure {
  ok: false;
  errors: string[];
}

export type SosSirenValidationResult<T> =
  | SosSirenValidationSuccess<T>
  | SosSirenValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseTriggerAlarmPayload(
  body: unknown
): SosSirenValidationResult<{ reason?: string }> {
  if (body !== undefined && !isRecord(body)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const reason = isRecord(body) ? body.reason : undefined;

  if (reason !== undefined && (typeof reason !== "string" || !reason.trim())) {
    return { ok: false, errors: ["reason must be a non-empty string"] };
  }

  return { ok: true, data: { ...(typeof reason === "string" ? { reason: reason.trim() } : {}) } };
}

export function parseProfileIdPayload(
  body: unknown
): SosSirenValidationResult<{ id: number }> {
  if (!isRecord(body) || !isNonNegativeInteger(body.id)) {
    return { ok: false, errors: ["id must be a non-negative integer"] };
  }

  return { ok: true, data: { id: body.id } };
}

export function parseTestProfilePayload(
  body: unknown
): SosSirenValidationResult<{ id: number; durationSec?: number }> {
  if (!isRecord(body) || !isNonNegativeInteger(body.id)) {
    return { ok: false, errors: ["id must be a non-negative integer"] };
  }

  if (body.durationSec !== undefined && !isNonNegativeInteger(body.durationSec)) {
    return { ok: false, errors: ["durationSec must be a non-negative integer"] };
  }

  return {
    ok: true,
    data: {
      id: body.id,
      ...(body.durationSec !== undefined ? { durationSec: body.durationSec } : {})
    }
  };
}

export function parseTestTonePayload(
  body: unknown
): SosSirenValidationResult<{ frequencyHz: number }> {
  if (!isRecord(body) || !isNonNegativeInteger(body.frequencyHz) || body.frequencyHz <= 0) {
    return { ok: false, errors: ["frequencyHz must be a positive integer"] };
  }

  return { ok: true, data: { frequencyHz: body.frequencyHz } };
}
