import type { AuthSession, TokenPair } from "@jenix/shared";

export const authSessionStorageKey = "jenix.auth.session.v1";
export const authSessionUpdatedEvent = "jenix:auth-session-updated";
export const authSessionExpiredEvent = "jenix:auth-session-expired";

export interface AuthSessionState {
  session: AuthSession;
  receivedAtMs: number;
  lastRefreshAttemptAtMs?: number;
}

interface StoredAuthSessionState {
  session: AuthSession;
  receivedAt: string;
  lastRefreshAttemptAt?: string;
}

export function createSessionState(
  session: AuthSession,
  receivedAtMs = Date.now(),
  lastRefreshAttemptAtMs?: number
): AuthSessionState {
  return {
    session,
    receivedAtMs,
    ...(lastRefreshAttemptAtMs !== undefined ? { lastRefreshAttemptAtMs } : {})
  };
}

export function shouldManageSessionRefresh(session: AuthSession): boolean {
  return (
    session.tokens.accessToken.split(".").length === 3 &&
    session.tokens.refreshToken.split(".").length === 3
  );
}

export function readStoredSession(): AuthSessionState | null {
  if (typeof window === "undefined") return null;
  const rawValue = window.localStorage.getItem(authSessionStorageKey);
  if (!rawValue) return null;
  try {
    const parsedValue = JSON.parse(rawValue) as StoredAuthSessionState | AuthSession;
    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      "session" in parsedValue &&
      parsedValue.session
    ) {
      const receivedAtMs = Date.parse(parsedValue.receivedAt);
      const lastRefreshAttemptAtMs = parsedValue.lastRefreshAttemptAt
        ? Date.parse(parsedValue.lastRefreshAttemptAt)
        : Number.NaN;
      return createSessionState(
        parsedValue.session,
        Number.isNaN(receivedAtMs) ? Date.now() : receivedAtMs,
        Number.isNaN(lastRefreshAttemptAtMs) ? undefined : lastRefreshAttemptAtMs
      );
    }
    return createSessionState(parsedValue as AuthSession);
  } catch {
    window.localStorage.removeItem(authSessionStorageKey);
    return null;
  }
}

export function writeStoredSession(sessionState: AuthSessionState | null) {
  if (typeof window === "undefined") return;
  if (!sessionState) {
    window.localStorage.removeItem(authSessionStorageKey);
    return;
  }
  const storedState: StoredAuthSessionState = {
    session: sessionState.session,
    receivedAt: new Date(sessionState.receivedAtMs).toISOString(),
    ...(sessionState.lastRefreshAttemptAtMs !== undefined
      ? { lastRefreshAttemptAt: new Date(sessionState.lastRefreshAttemptAtMs).toISOString() }
      : {})
  };
  window.localStorage.setItem(authSessionStorageKey, JSON.stringify(storedState));
}

export function replaceStoredSessionTokens(tokens: TokenPair): AuthSession | null {
  const current = readStoredSession();
  if (!current) return null;
  const nextSession = { ...current.session, tokens };
  writeStoredSession(createSessionState(nextSession));
  return nextSession;
}

export function emitAuthSessionUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(authSessionUpdatedEvent));
  }
}

export function emitAuthSessionExpired() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(authSessionStorageKey);
    window.dispatchEvent(new Event(authSessionExpiredEvent));
  }
}
