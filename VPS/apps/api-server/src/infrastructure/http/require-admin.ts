import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

/**
 * SEC-01 fix — real perimeter gate for the /api/v1/admin/* surface
 * (PID management, OTA release publishing, API packages).
 *
 * The admin controllers already check the `x-role` developer header, but a
 * header alone is trivially spoofable. This middleware additionally requires a
 * shared secret (`x-admin-key` matched in constant time against ADMIN_API_KEY),
 * so the dangerous admin/OTA endpoints cannot be reached by anyone who simply
 * sets `x-role: JENIX_DEVELOPER`.
 *
 * Behaviour: enforcement is ACTIVE only when ADMIN_API_KEY is configured. When
 * the key is unset the gate passes through — this keeps a live deployment
 * working while operators roll out the key to the admin console, then flip
 * enforcement on by simply setting ADMIN_API_KEY in the server .env.
 *
 * Follow-up (documented in DEVICE_INTEGRATION_GUIDE.md → "Admin auth"): move
 * developer identity to a verified session/JWT and derive the role from signed
 * claims rather than a raw header.
 */
function configuredAdminKey(): string | undefined {
  const value = process.env.ADMIN_API_KEY?.trim();
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

export function requireAdminApiKey(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const expectedKey = configuredAdminKey();

  // Enforcement is opt-in: pass through until ADMIN_API_KEY is set.
  if (!expectedKey) {
    next();
    return;
  }

  const providedKey = request.header("x-admin-key")?.trim() ?? "";

  if (!providedKey || !constantTimeEquals(providedKey, expectedKey)) {
    response.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  next();
}
