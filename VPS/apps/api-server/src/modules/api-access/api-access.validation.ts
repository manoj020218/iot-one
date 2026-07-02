import type {
  ParsedApiKeyPayload,
  ParsedApiPackagePayload,
  ParsedPublicCommandPayload
} from "./api-access.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(
  body: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = body[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return strings.length ? strings : undefined;
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const timestamp = value.trim();
  return Number.isNaN(Date.parse(timestamp)) ? undefined : timestamp;
}

export function parseApiPackagePayload(
  body: unknown
): ParsedApiPackagePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const packageId = readTrimmedString(body, "packageId");
  const pid = readTrimmedString(body, "pid");
  const name = readTrimmedString(body, "name");
  const scopes = readStringArray(body, "scopes");
  const docsUrl = readTrimmedString(body, "docsUrl");
  const status =
    body.status === "draft" || body.status === "active" || body.status === "retired"
      ? body.status
      : undefined;
  const rateLimitPerMinute =
    typeof body.rateLimitPerMinute === "number" && body.rateLimitPerMinute > 0
      ? body.rateLimitPerMinute
      : undefined;

  if (!packageId || !pid || !name || !scopes) {
    return null;
  }

  return {
    packageId,
    pid,
    name,
    scopes,
    ...(status ? { status } : {}),
    ...(docsUrl ? { docsUrl } : {}),
    ...(rateLimitPerMinute ? { rateLimitPerMinute } : {})
  };
}

export function parseApiKeyPayload(body: unknown): ParsedApiKeyPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const packageId = readTrimmedString(body, "packageId");
  const label = readTrimmedString(body, "label");
  const scopes = readStringArray(body, "scopes");
  const expiresAt = parseIsoTimestamp(body.expiresAt);

  if (!packageId || !label) {
    return null;
  }

  return {
    packageId,
    label,
    ...(scopes ? { scopes } : {}),
    ...(expiresAt ? { expiresAt } : {})
  };
}

export function parsePublicCommandPayload(
  body: unknown
): ParsedPublicCommandPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const command = readTrimmedString(body, "command");

  if (!command) {
    return null;
  }

  return {
    command
  };
}
