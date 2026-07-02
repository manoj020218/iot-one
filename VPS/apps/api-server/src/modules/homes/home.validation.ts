import type { HomeAccessRole } from "@jenix/shared";

import type {
  CreateHomeShareCodePayload,
  RedeemHomeShareCodePayload,
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
