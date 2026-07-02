import { ensureDefaultHome, type AuthProvider, type AuthSession, type TokenPair } from "@jenix/shared";

import type {
  AuthProviderSessionSeed,
  EmailLoginPayload,
  EmailSignupPayload,
  ProviderAuthPayload
} from "./auth.types";
import { syncUserHomes } from "../homes/home.service";

function createUserId(email: string): string {
  return `user-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function createTokenPair(userId: string): TokenPair {
  return {
    accessToken: `access-${userId}`,
    refreshToken: `refresh-${userId}`,
    expiresInSeconds: 900
  };
}

function createSession(seed: AuthProviderSessionSeed): AuthSession {
  const userId = createUserId(seed.email);
  const homes = syncUserHomes({
    userId,
    name: seed.name,
    email: seed.email
  });
  const normalizedHomes = ensureDefaultHome(homes, userId);

  return {
    user: {
      userId,
      email: seed.email.trim().toLowerCase(),
      name: seed.name.trim(),
      provider: seed.provider
    },
    homes: normalizedHomes,
    activeHomeId: normalizedHomes[0]!.homeId,
    tokens: createTokenPair(userId)
  };
}

export function signupWithEmail(payload: EmailSignupPayload): AuthSession {
  return createSession({
    email: payload.email,
    name: payload.name,
    provider: "email"
  });
}

export function loginWithEmail(payload: EmailLoginPayload): AuthSession {
  return createSession({
    email: payload.email,
    name: payload.email.split("@")[0] ?? "Jenix User",
    provider: "email"
  });
}

export function loginWithProvider(
  payload: ProviderAuthPayload,
  provider: AuthProvider
): AuthSession {
  const tokenSeed = payload.token.trim() || provider;

  return createSession({
    email: `${provider}.${tokenSeed}@jenix.local`,
    name: `${provider[0]!.toUpperCase()}${provider.slice(1)} User`,
    provider
  });
}

export function refreshAccessToken(refreshToken: string): TokenPair {
  const suffix = refreshToken.replace(/^refresh-/, "");
  return createTokenPair(suffix || "anonymous");
}
