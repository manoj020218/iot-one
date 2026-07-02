import type { AuthSession, AuthProvider } from "@jenix/shared";
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
