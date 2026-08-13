import type {
  CreateSpeakerGroupInput,
  UpdateSpeakerGroupInput
} from "./group.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDeviceIds(body: Record<string, unknown>): string[] | undefined {
  const value = body.deviceIds;
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseCreateSpeakerGroupInput(
  body: unknown
): CreateSpeakerGroupInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const name = readString(body, "name");
  const deviceIds = readDeviceIds(body);

  if (!name || !deviceIds) {
    return null;
  }

  return {
    name,
    deviceIds,
    ...optionalProp("description", readString(body, "description"))
  };
}

export function parseUpdateSpeakerGroupInput(
  body: unknown
): UpdateSpeakerGroupInput | null {
  if (!isRecord(body)) {
    return null;
  }

  return {
    ...optionalProp("name", readString(body, "name")),
    ...optionalProp("description", readString(body, "description")),
    ...optionalProp("deviceIds", readDeviceIds(body))
  };
}
