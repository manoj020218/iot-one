import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

/**
 * SEC-02 fix — authenticate device-facing endpoints (telemetry ingest,
 * self-registration) that cannot present a user JWT.
 *
 * First line of defence: a shared ingest key supplied by firmware in the
 * `x-device-key` header, compared in constant time. Enforcement is ACTIVE only
 * when DEVICE_INGEST_KEY is configured — when unset the gate passes through, so
 * a live deployment keeps ingesting telemetry while firmware is updated to send
 * the header, then enforcement switches on by setting the key. The recommended
 * follow-up is a per-device secret / HMAC (see DEVICE_INTEGRATION_GUIDE.md).
 */
function configuredIngestKey(): string | undefined {
  const value = process.env.DEVICE_INGEST_KEY?.trim();
  return value && value.length > 0 ? value : undefined;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

export function requireDeviceIngestAuth(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const expectedKey = configuredIngestKey();

  // Enforcement is opt-in: pass through until DEVICE_INGEST_KEY is set.
  if (!expectedKey) {
    next();
    return;
  }

  const providedKey = request.header("x-device-key")?.trim() ?? "";

  if (!providedKey || !constantTimeEquals(providedKey, expectedKey)) {
    response.status(401).json({ error: "Invalid device credentials" });
    return;
  }

  next();
}
