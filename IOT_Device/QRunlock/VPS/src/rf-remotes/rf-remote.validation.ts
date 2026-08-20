import type { AddRfRemoteInput, RenameRfRemoteInput } from "./rf-remote.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Empty body is valid — name is optional and defaults to "Remote N".
export function parseAddRfRemoteInput(body: unknown): AddRfRemoteInput {
  if (!isRecord(body)) {
    return {};
  }
  const name = body.name;
  return typeof name === "string" && name.trim() ? { name: name.trim() } : {};
}

export function parseRenameRfRemoteInput(body: unknown): RenameRfRemoteInput | null {
  if (!isRecord(body)) {
    return null;
  }
  const name = body.name;
  if (typeof name !== "string" || !name.trim()) {
    return null;
  }
  return { name: name.trim() };
}
