import type { HomeAccessRole } from "@jenix/shared";

import type {
  CreateHomePayload,
  CreateHomeShareCodePayload,
  RedeemHomeShareCodePayload,
  UpdateHomeMemberAccessPayload,
  UpdateHomePayload,
  UpdateHomeMemberRolePayload
} from "./home.types";

function readTrimmedString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseRole(value: string): Exclude<HomeAccessRole, "owner"> | null {
  return value === "admin" || value === "member" || value === "viewer"
    ? value
    : null;
}

function readOptionalNumber(
  body: Record<string, unknown>,
  key: string
): number | undefined | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseHomePayload(body: unknown): CreateHomePayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const name = readTrimmedString(record, "name");
  if (!name) {
    return null;
  }

  const timezone = readTrimmedString(record, "timezone");
  const locationLabel = readTrimmedString(record, "locationLabel");
  const latitude = readOptionalNumber(record, "latitude");
  const longitude = readOptionalNumber(record, "longitude");

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    name,
    ...(timezone ? { timezone } : {}),
    ...(locationLabel ? { locationLabel } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {})
  };
}

export function parseCreateHomePayload(body: unknown): CreateHomePayload | null {
  return parseHomePayload(body);
}

export function parseCreateHomeShareCodePayload(
  body: unknown
): CreateHomeShareCodePayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const role = parseRole(readTrimmedString(body as Record<string, unknown>, "role"));

  if (!role) {
    return null;
  }

  const rawExpiresInHours = (body as Record<string, unknown>).expiresInHours;
  const expiresInHours =
    typeof rawExpiresInHours === "number" && Number.isFinite(rawExpiresInHours)
      ? Math.trunc(rawExpiresInHours)
      : undefined;

  if (expiresInHours !== undefined && expiresInHours <= 0) {
    return null;
  }

  return {
    role,
    ...(expiresInHours !== undefined ? { expiresInHours } : {})
  };
}

export function parseRedeemHomeShareCodePayload(
  body: unknown
): RedeemHomeShareCodePayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const code = readTrimmedString(body as Record<string, unknown>, "code");

  return code ? { code } : null;
}

export function parseUpdateHomeMemberRolePayload(
  body: unknown
): UpdateHomeMemberRolePayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const role = parseRole(readTrimmedString(body as Record<string, unknown>, "role"));

  return role ? { role } : null;
}

export function parseUpdateHomePayload(body: unknown): UpdateHomePayload | null {
  return parseHomePayload(body);
}

export function parseUpdateHomeMemberAccessPayload(
  body: unknown
): UpdateHomeMemberAccessPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = (body as Record<string, unknown>).allowed;
  return typeof value === "boolean" ? { allowed: value } : null;
}
