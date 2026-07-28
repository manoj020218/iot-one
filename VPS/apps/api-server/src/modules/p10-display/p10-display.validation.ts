export interface P10DisplayValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface P10DisplayValidationFailure {
  ok: false;
  errors: string[];
}

export type P10DisplayValidationResult<T> =
  | P10DisplayValidationSuccess<T>
  | P10DisplayValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseSetTokenPayload(
  body: unknown
): P10DisplayValidationResult<{ token: number; counter?: number; announce?: boolean }> {
  if (!isRecord(body) || !isNonNegativeInteger(body.token)) {
    return { ok: false, errors: ["token must be a non-negative integer"] };
  }

  if (body.counter !== undefined && !isNonNegativeInteger(body.counter)) {
    return { ok: false, errors: ["counter must be a non-negative integer"] };
  }

  return {
    ok: true,
    data: {
      token: body.token,
      ...(body.counter !== undefined ? { counter: body.counter } : {}),
      ...(typeof body.announce === "boolean" ? { announce: body.announce } : {})
    }
  };
}

export function parseAnnouncePayload(
  body: unknown
): P10DisplayValidationResult<{ announce?: boolean }> {
  if (body !== undefined && !isRecord(body)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const announce = isRecord(body) ? body.announce : undefined;

  if (announce !== undefined && typeof announce !== "boolean") {
    return { ok: false, errors: ["announce must be a boolean"] };
  }

  return { ok: true, data: { ...(typeof announce === "boolean" ? { announce } : {}) } };
}

export function parseSetCounterPayload(
  body: unknown
): P10DisplayValidationResult<{ counter: number }> {
  if (!isRecord(body) || !isNonNegativeInteger(body.counter)) {
    return { ok: false, errors: ["counter must be a non-negative integer"] };
  }

  return { ok: true, data: { counter: body.counter } };
}

export function parseTextPayload(
  body: unknown
): P10DisplayValidationResult<{ text: string }> {
  if (!isRecord(body) || typeof body.text !== "string" || !body.text.trim()) {
    return { ok: false, errors: ["text is required"] };
  }

  if (body.text.length > 95) {
    return { ok: false, errors: ["text must be 95 characters or fewer"] };
  }

  return { ok: true, data: { text: body.text } };
}

export function parseSetBrightnessPayload(
  body: unknown
): P10DisplayValidationResult<{ brightness: number }> {
  if (
    !isRecord(body) ||
    typeof body.brightness !== "number" ||
    !Number.isInteger(body.brightness) ||
    body.brightness < 0 ||
    body.brightness > 100
  ) {
    return { ok: false, errors: ["brightness must be an integer between 0 and 100"] };
  }

  return { ok: true, data: { brightness: body.brightness } };
}

const supportedAnnouncementLanguages = new Set(["hindi", "english"]);

export function parsePlayAnnouncementPayload(
  body: unknown
): P10DisplayValidationResult<{ language?: string; token?: number; counter?: number }> {
  if (body !== undefined && !isRecord(body)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const record = isRecord(body) ? body : {};

  if (
    record.language !== undefined &&
    (typeof record.language !== "string" ||
      !supportedAnnouncementLanguages.has(record.language.toLowerCase()))
  ) {
    return { ok: false, errors: ["language must be 'hindi' or 'english'"] };
  }

  if (record.token !== undefined && !isNonNegativeInteger(record.token)) {
    return { ok: false, errors: ["token must be a non-negative integer"] };
  }

  if (record.counter !== undefined && !isNonNegativeInteger(record.counter)) {
    return { ok: false, errors: ["counter must be a non-negative integer"] };
  }

  return {
    ok: true,
    data: {
      ...(typeof record.language === "string"
        ? { language: record.language.toLowerCase() }
        : {}),
      ...(record.token !== undefined ? { token: record.token as number } : {}),
      ...(record.counter !== undefined ? { counter: record.counter as number } : {})
    }
  };
}
