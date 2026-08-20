import type { AuthSession } from "@jenix/shared";

import { refreshAuthSession } from "../features/auth/services/authApi";
import {
  emitAuthSessionExpired,
  emitAuthSessionUpdated,
  readStoredSession,
  replaceStoredSessionTokens,
  shouldManageSessionRefresh
} from "./authSessionStorage";

export class ApiResponseError extends Error {
  constructor(
    public readonly status: number,
    message = `Request failed with status ${status}`,
    // Populated from the response body's { error: { code, details } }
    // when present (every plugin backend's error envelope — see e.g.
    // IOT_Device/QRunlock/VPS/API_CONTRACT.md §7). Undefined for
    // non-JSON error bodies or modules that haven't adopted the
    // envelope, so callers must not assume these are always set.
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export class ApiUnauthorizedError extends ApiResponseError {
  constructor() {
    super(401, "Session is no longer authorized");
  }
}

export function isApiUnauthorizedError(error: unknown): error is ApiUnauthorizedError {
  return error instanceof ApiUnauthorizedError;
}

export function shouldUseDemoFallback(error: unknown): boolean {
  if (error instanceof ApiUnauthorizedError) return false;
  if (error instanceof ApiResponseError) return error.status >= 500 || error.status === 404;
  return true;
}

let refreshPromise: Promise<AuthSession | null | "unavailable"> | null = null;

function withAccessToken(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

async function refreshStoredSession(): Promise<AuthSession | null | "unavailable"> {
  const current = readStoredSession();
  if (!current || !shouldManageSessionRefresh(current.session)) {
    emitAuthSessionExpired();
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const result = await refreshAuthSession(current.session);
      if (result.status === "success") {
        const nextSession = replaceStoredSessionTokens(result.tokens);
        emitAuthSessionUpdated();
        return nextSession;
      }
      if (result.status === "unauthorized") {
        emitAuthSessionExpired();
        return null;
      }
      return "unavailable";
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function fetchAuthenticatedJson<T>(
  url: string,
  session: AuthSession,
  init: RequestInit
): Promise<T> {
  let response = await fetch(url, withAccessToken(init, session.tokens.accessToken));
  if (response.status === 401) {
    const refreshed = await refreshStoredSession();
    if (refreshed === "unavailable") {
      throw new ApiResponseError(401);
    }
    if (!refreshed) {
      throw new ApiUnauthorizedError();
    }
    response = await fetch(url, withAccessToken(init, refreshed.tokens.accessToken));
    if (response.status === 401) {
      emitAuthSessionExpired();
      throw new ApiUnauthorizedError();
    }
  }
  if (!response.ok) {
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    let message: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
      };
      code = body.error?.code;
      message = body.error?.message;
      details = body.error?.details;
    } catch {
      // Error body wasn't JSON (or had no body) — fall through with the
      // generic "Request failed with status N" message.
    }
    throw new ApiResponseError(response.status, message, code, details);
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}
