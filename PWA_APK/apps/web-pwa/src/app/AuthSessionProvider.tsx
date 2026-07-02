import type { AuthSession, AuthProvider, HomeRecord } from "@jenix/shared";
import { createContext, useState, type PropsWithChildren } from "react";

import {
  loginWithEmail as loginWithEmailRequest,
  loginWithProvider as loginWithProviderRequest,
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

export interface AuthSessionProviderProps extends PropsWithChildren {
  initialSession?: AuthSession | null;
}

export function AuthSessionProvider({
  children,
  initialSession = null
}: AuthSessionProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(initialSession);

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
      setSession(null);
    }
  };

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}
