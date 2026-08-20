import type { UnlockInput } from "./lock.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Empty body is valid — reason and requestId are both optional.
export function parseUnlockInput(body: unknown): UnlockInput {
  if (!isRecord(body)) {
    return {};
  }

  const reason = readString(body, "reason");
  const requestId = readString(body, "requestId");

  return {
    ...(reason ? { reason } : {}),
    ...(requestId ? { requestId } : {})
  };
}
