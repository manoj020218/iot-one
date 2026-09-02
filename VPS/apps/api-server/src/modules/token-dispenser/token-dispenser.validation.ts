import type { TokenDispenserPrintTemplate } from "./token-dispenser.types";

export interface TokenDispenserValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface TokenDispenserValidationFailure {
  ok: false;
  errors: string[];
}

export type TokenDispenserValidationResult<T> =
  | TokenDispenserValidationSuccess<T>
  | TokenDispenserValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSetCounterPayload(
  body: unknown
): TokenDispenserValidationResult<{ value: number }> {
  if (!isRecord(body) || typeof body.value !== "number" || body.value < 0) {
    return { ok: false, errors: ["value must be a non-negative number"] };
  }

  return { ok: true, data: { value: body.value } };
}

export function parseSetLedCountPayload(
  body: unknown
): TokenDispenserValidationResult<{ value: number }> {
  if (
    !isRecord(body) ||
    typeof body.value !== "number" ||
    !Number.isInteger(body.value) ||
    body.value < 1 ||
    body.value > 8
  ) {
    return { ok: false, errors: ["value must be an integer from 1 to 8"] };
  }

  return { ok: true, data: { value: body.value } };
}

export function parseSetPrefixPayload(
  body: unknown
): TokenDispenserValidationResult<{ prefix: string }> {
  if (
    !isRecord(body) ||
    typeof body.prefix !== "string" ||
    !body.prefix.trim() ||
    body.prefix.trim().length > 4
  ) {
    return { ok: false, errors: ["prefix must be 1-4 characters"] };
  }

  return { ok: true, data: { prefix: body.prefix.trim().toUpperCase() } };
}

export function parsePrintTemplatePayload(
  body: unknown
): TokenDispenserValidationResult<TokenDispenserPrintTemplate> {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Template payload must be an object"] };
  }

  const errors: string[] = [];
  const header = typeof body.header === "string" ? body.header : "";
  const queueName = typeof body.queueName === "string" ? body.queueName : "";
  const tokenPrefix = typeof body.tokenPrefix === "string" ? body.tokenPrefix : "";
  const qrPayload = typeof body.qrPayload === "string" ? body.qrPayload : "";
  const footer = typeof body.footer === "string" ? body.footer : "";

  if (!header.trim()) errors.push("header is required");
  if (!queueName.trim()) errors.push("queueName is required");
  if (!tokenPrefix.trim()) errors.push("tokenPrefix is required");

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      header,
      queueName,
      tokenPrefix,
      showDateTime: body.showDateTime !== false,
      showQr: body.showQr !== false,
      qrPayload,
      footer
    }
  };
}
