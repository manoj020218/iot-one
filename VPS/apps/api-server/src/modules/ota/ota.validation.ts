import type { ParsedOtaReleasePayload } from "./ota.types";

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

export function parseOtaReleasePayload(
  body: unknown
): ParsedOtaReleasePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const releaseId = readTrimmedString(body, "releaseId");
  const pid = readTrimmedString(body, "pid");
  const hardwareRevision = readTrimmedString(body, "hardwareRevision");
  const version = readTrimmedString(body, "version");
  const artifactUrl = readTrimmedString(body, "artifactUrl");
  const checksum = readTrimmedString(body, "checksum");
  const channel = body.channel === "stable" || body.channel === "beta"
    ? body.channel
    : undefined;
  const status =
    body.status === "draft" ||
    body.status === "published" ||
    body.status === "retired"
      ? body.status
      : undefined;
  const notes = readTrimmedString(body, "notes");

  if (
    !releaseId ||
    !pid ||
    !hardwareRevision ||
    !version ||
    !artifactUrl ||
    !checksum ||
    !channel
  ) {
    return null;
  }

  return {
    releaseId,
    pid,
    hardwareRevision,
    version,
    channel,
    artifactUrl,
    checksum,
    ...(status ? { status } : {}),
    ...(notes ? { notes } : {})
  };
}
