import type { AuthSession, AuthProvider, HomeRecord } from "@jenix/shared";
import {
  createContext,
  useEffect,
  useState,
  type PropsWithChildren
} from "react";

import {
  loginWithEmail as loginWithEmailRequest,
  loginWithProvider as loginWithProviderRequest,
  logoutSession as logoutSessionRequest,
  refreshAuthSession as refreshAuthSessionRequest,
  signupWithEmail as signupWithEmailRequest
} from "../features/auth/services/authApi";
import {
  authSessionExpiredEvent,
  authSessionUpdatedEvent,
  createSessionState,
  readStoredSession,
  shouldManageSessionRefresh,
  writeStoredSession,
  type AuthSessionState
} from "./authSessionStorage";

export interface AuthContextValue {
  session: AuthSession | null;
  loginWithEmail: (payload: { email: string; password: string }) => Promise<void>;
  signupWithEmail: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  loginWithProvider: (provider: AuthProvider) => Promise<void>;
  replaceHomes: (homes: HomeRecord[], activeHomeId?: string) => void;
  setActiveHome: (homeId: string) => void;
  logout: () => void;
}

export const AuthSessionContext = createContext<AuthContextValue | null>(null);
const authSessionRefreshLeadMs = 60_000;
const authSessionRefreshRetryMs = 60_000;

export interface AuthSessionProviderProps extends PropsWithChildren {
  initialSession?: AuthSession | null;
}

export function AuthSessionProvider({
  children,
  initialSession = null
}: AuthSessionProviderProps) {
  const [sessionState, setSessionState] = useState<AuthSessionState | null>(
    () =>
      (initialSession ? createSessionState(initialSession) : null) ??
      readStoredSession()
  );
  const session = sessionState?.session ?? null;

  useEffect(() => {
    writeStoredSession(sessionState);
  }, [sessionState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromStorage = () => {
      setSessionState(readStoredSession());
    };
    const clearSession = () => {
      setSessionState(null);
    };
    window.addEventListener(authSessionUpdatedEvent, syncFromStorage);
    window.addEventListener(authSessionExpiredEvent, clearSession);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(authSessionUpdatedEvent, syncFromStorage);
      window.removeEventListener(authSessionExpiredEvent, clearSession);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!sessionState || !shouldManageSessionRefresh(sessionState.session)) {
      return;
    }

    const accessTokenExpiryMs =
      sessionState.receivedAtMs + sessionState.session.tokens.expiresInSeconds * 1000;
    const refreshTargetMs = accessTokenExpiryMs - authSessionRefreshLeadMs;
    const nowMs = Date.now();
    const delayMs =
      nowMs >= refreshTargetMs
        ? Math.max(
            1_000,
            (sessionState.lastRefreshAttemptAtMs ?? 0) +
              authSessionRefreshRetryMs -
              nowMs
          )
        : refreshTargetMs - nowMs;
    const timer = window.setTimeout(() => {
      void refreshManagedSession(sessionState);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sessionState]);

  function getNextActiveHomeId(
    homes: HomeRecord[],
    currentActiveHomeId?: string,
    requestedActiveHomeId?: string
  ) {
    const candidateHomeId = requestedActiveHomeId ?? currentActiveHomeId;

    if (candidateHomeId && homes.some((home) => home.homeId === candidateHomeId)) {
      return candidateHomeId;
    }

    return homes[0]?.homeId;
  }

  function applyHomesToSession(
    current: AuthSessionState,
    homes: HomeRecord[],
    requestedActiveHomeId?: string
  ): AuthSessionState {
    const nextActiveHomeId = getNextActiveHomeId(
      homes,
      current.session.activeHomeId,
      requestedActiveHomeId
    );

    return createSessionState(
      {
        ...current.session,
        homes,
        ...(nextActiveHomeId ? { activeHomeId: nextActiveHomeId } : {})
      },
      current.receivedAtMs,
      current.lastRefreshAttemptAtMs
    );
  }

  async function refreshManagedSession(currentState: AuthSessionState) {
    const refreshResult = await refreshAuthSessionRequest(currentState.session);

    setSessionState((existingState) => {
      if (
        !existingState ||
        existingState.session.tokens.refreshToken !==
          currentState.session.tokens.refreshToken
      ) {
        return existingState;
      }

      if (refreshResult.status === "success") {
        return createSessionState(
          {
            ...existingState.session,
            tokens: refreshResult.tokens
          }
        );
      }

      if (refreshResult.status === "unauthorized") {
        return null;
      }

      return createSessionState(
        existingState.session,
        existingState.receivedAtMs,
        Date.now()
      );
    });
  }

  const value: AuthContextValue = {
    session,
    async loginWithEmail(payload) {
      setSessionState(createSessionState(await loginWithEmailRequest(payload)));
    },
    async signupWithEmail(payload) {
      setSessionState(createSessionState(await signupWithEmailRequest(payload)));
    },
    async loginWithProvider(provider) {
      setSessionState(createSessionState(await loginWithProviderRequest(provider)));
    },
    replaceHomes(homes, activeHomeId) {
      setSessionState((current) => {
        if (!current) {
          return current;
        }

        return applyHomesToSession(current, homes, activeHomeId);
      });
    },
    setActiveHome(homeId) {
      setSessionState((current) => {
        if (
          !current ||
          !current.session.homes.some((home) => home.homeId === homeId)
        ) {
          return current;
        }

        return createSessionState(
          {
            ...current.session,
            activeHomeId: homeId
          },
          current.receivedAtMs,
          current.lastRefreshAttemptAtMs
        );
      });
    },
    logout() {
      setSessionState((current) => {
        void logoutSessionRequest(current?.session ?? null);
        return null;
      });
    }
  };

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}
