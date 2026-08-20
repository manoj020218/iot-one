import type { CreateDestinationInput, UpdateDestinationInput } from "./destination.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  return typeof value === "boolean" ? value : undefined;
}

function readPlatform(
  body: Record<string, unknown>
): CreateDestinationInput["platform"] | undefined {
  const value = body.platform;
  return value === "youtube" || value === "facebook" || value === "instagram"
    ? value
    : undefined;
}

function readCredentialMode(
  body: Record<string, unknown>
): CreateDestinationInput["credentialMode"] | undefined {
  const value = body.credentialMode;
  return value === "persistent" || value === "temporary" || value === "oauth"
    ? value
    : undefined;
}

function optionalProp<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseCreateDestinationInput(body: unknown): CreateDestinationInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const platform = readPlatform(body);
  const displayName = readString(body, "displayName");
  const serverUrl = readString(body, "serverUrl");

  if (!platform || !displayName || !serverUrl) {
    return null;
  }

  return {
    platform,
    displayName,
    serverUrl,
    ...optionalProp("platformLabel", readString(body, "platformLabel")),
    ...optionalProp("streamKey", readString(body, "streamKey")),
    ...optionalProp("credentialMode", readCredentialMode(body)),
    ...optionalProp("credentialExpiry", readString(body, "credentialExpiry")),
    ...optionalProp("enabled", readBoolean(body, "enabled"))
  };
}

export function parseUpdateDestinationInput(body: unknown): UpdateDestinationInput | null {
  if (!isRecord(body)) {
    return null;
  }

  return {
    ...optionalProp("platform", readPlatform(body)),
    ...optionalProp("displayName", readString(body, "displayName")),
    ...optionalProp("platformLabel", readString(body, "platformLabel")),
    ...optionalProp("serverUrl", readString(body, "serverUrl")),
    ...optionalProp("streamKey", readString(body, "streamKey")),
    ...optionalProp("credentialMode", readCredentialMode(body)),
    ...optionalProp("credentialExpiry", readString(body, "credentialExpiry")),
    ...optionalProp("enabled", readBoolean(body, "enabled"))
  };
}
