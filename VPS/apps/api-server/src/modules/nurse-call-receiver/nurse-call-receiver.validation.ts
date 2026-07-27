import type { NurseCallDeviceCommand, SaveRemoteInput } from "./nurse-call-receiver.types";

export interface NurseCallValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface NurseCallValidationFailure {
  ok: false;
  errors: string[];
}

export type NurseCallValidationResult<T> =
  | NurseCallValidationSuccess<T>
  | NurseCallValidationFailure;

const nurseCallDeviceCommands: NurseCallDeviceCommand[] = [
  "refresh",
  "restart",
  "start_learning",
  "attend_call",
  "factory_reset"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[],
  required = true
): string | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    if (required) {
      errors.push(`${label} is required`);
    }
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be a non-empty string`);
    return undefined;
  }

  return value.trim();
}

export function parseSaveRemotePayload(
  body: unknown
): NurseCallValidationResult<SaveRemoteInput> {
  const errors: string[] = [];

  if (!isRecord(body)) {
    return { ok: false, errors: ["Remote payload must be an object"] };
  }

  const name = readTrimmedString(body, "name", "name", errors) ?? "";
  const remoteType = body.remoteType;
  const wardLabel = readTrimmedString(body, "wardLabel", "wardLabel", errors, false);
  const roomLabel = readTrimmedString(body, "roomLabel", "roomLabel", errors, false);
  const bedLabel = readTrimmedString(body, "bedLabel", "bedLabel", errors, false);

  if (typeof remoteType !== "number" || !Number.isFinite(remoteType)) {
    errors.push("remoteType must be a finite number");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name,
      remoteType: remoteType as number,
      ...(wardLabel ? { wardLabel } : {}),
      ...(roomLabel ? { roomLabel } : {}),
      ...(bedLabel ? { bedLabel } : {})
    }
  };
}

export function parseNurseCallCommandPayload(
  body: unknown
): NurseCallValidationResult<{
  command: NurseCallDeviceCommand;
  payload?: Record<string, unknown>;
}> {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Command payload must be an object"] };
  }

  const command = body.command;

  if (
    typeof command !== "string" ||
    !nurseCallDeviceCommands.includes(command as NurseCallDeviceCommand)
  ) {
    return {
      ok: false,
      errors: [`command must be one of: ${nurseCallDeviceCommands.join(", ")}`]
    };
  }

  const payload = body.payload;

  if (payload !== undefined && !isRecord(payload)) {
    return { ok: false, errors: ["payload must be an object when provided"] };
  }

  return {
    ok: true,
    data: {
      command: command as NurseCallDeviceCommand,
      ...(payload ? { payload: payload as Record<string, unknown> } : {})
    }
  };
}
