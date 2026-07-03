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
  signupWithEmail as signupWithEmailRequest
} from "../features/auth/services/authApi";

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
const authSessionStorageKey = "jenix.auth.session.v1";

export interface AuthSessionProviderProps extends PropsWithChildren {
  initialSession?: AuthSession | null;
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(authSessionStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    window.localStorage.removeItem(authSessionStorageKey);
    return null;
  }
}

export function AuthSessionProvider({
  children,
  initialSession = null
}: AuthSessionProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(
    () => initialSession ?? readStoredSession()
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!session) {
      window.localStorage.removeItem(authSessionStorageKey);
      return;
    }

    window.localStorage.setItem(authSessionStorageKey, JSON.stringify(session));
  }, [session]);

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
    current: AuthSession,
    homes: HomeRecord[],
    requestedActiveHomeId?: string
  ): AuthSession {
    const nextActiveHomeId = getNextActiveHomeId(
      homes,
      current.activeHomeId,
      requestedActiveHomeId
    );

    return {
      ...current,
      homes,
      ...(nextActiveHomeId ? { activeHomeId: nextActiveHomeId } : {})
    };
  }

  const value: AuthContextValue = {
    session,
    async loginWithEmail(payload) {
      setSession(await loginWithEmailRequest(payload));
    },
    async signupWithEmail(payload) {
      setSession(await signupWithEmailRequest(payload));
    },
    async loginWithProvider(provider) {
      setSession(await loginWithProviderRequest(provider));
    },
    replaceHomes(homes, activeHomeId) {
      setSession((current) => {
        if (!current) {
          return current;
        }

        return applyHomesToSession(current, homes, activeHomeId);
      });
    },
    setActiveHome(homeId) {
      setSession((current) => {
        if (!current || !current.homes.some((home) => home.homeId === homeId)) {
          return current;
        }

        return {
          ...current,
          activeHomeId: homeId
        };
      });
    },
    logout() {
      setSession((current) => {
        void logoutSessionRequest(current);
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
