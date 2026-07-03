import { createHash } from "node:crypto";

import {
  ensureDefaultHome,
  type AuthProvider,
  type AuthSession,
  type TokenPair
} from "@jenix/shared";

import { syncUserHomes } from "../homes/home.service";
import {
  authRefreshSessionRepository,
  authUserRepository,
  type AuthRefreshSessionRecord,
  type AuthUserRecord
} from "./auth.model";
import { hashSecret, issueTokenPair, verifyRefreshToken } from "./auth.token";
import type {
  AuthenticatedRequestUser,
  AuthProviderSessionSeed,
  EmailLoginPayload,
  EmailSignupPayload,
  ProviderAuthPayload
} from "./auth.types";
import { AuthModuleError } from "./auth.types";

function createUserId(email: string): string {
  return `user-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function hashPassword(password: string): string {
  return createHash("sha256")
    .update(`jenix-auth-password:${password}`)
    .digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthenticatedUser(user: AuthUserRecord): AuthenticatedRequestUser {
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    provider: user.provider
  };
}

async function persistRefreshSession(record: AuthRefreshSessionRecord) {
  await authRefreshSessionRepository.save(record);
}

async function buildSession(user: AuthUserRecord): Promise<AuthSession> {
  const homes = await syncUserHomes({
    userId: user.userId,
    name: user.name,
    email: user.email
  });
  const normalizedHomes = ensureDefaultHome(homes, user.userId);
  const issued = issueTokenPair({
    user
  });

  await persistRefreshSession(issued.refreshSession);

  return {
    user: toAuthenticatedUser(user),
    homes: normalizedHomes,
    activeHomeId: normalizedHomes[0]!.homeId,
    tokens: issued.tokenPair
  };
}

async function requireUserByEmail(email: string): Promise<AuthUserRecord> {
  const normalizedEmail = normalizeEmail(email);
  const user = await authUserRepository.getByEmail(normalizedEmail);

  if (!user) {
    throw new AuthModuleError(401, "Invalid email or password");
  }

  return user;
}

async function requireUserById(userId: string): Promise<AuthUserRecord> {
  const user = await authUserRepository.getByUserId(userId);

  if (!user) {
    throw new AuthModuleError(401, "Authenticated user was not found");
  }

  return user;
}

async function createEmailUser(payload: EmailSignupPayload): Promise<AuthUserRecord> {
  const normalizedEmail = normalizeEmail(payload.email);
  const existing = await authUserRepository.getByEmail(normalizedEmail);

  if (existing) {
    throw new AuthModuleError(409, `User already exists for ${normalizedEmail}`);
  }

  const timestamp = new Date().toISOString();
  return authUserRepository.save({
    userId: createUserId(normalizedEmail),
    email: normalizedEmail,
    name: payload.name.trim(),
    provider: "email",
    passwordHash: hashPassword(payload.password),
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function upsertProviderUser(
  seed: AuthProviderSessionSeed
): Promise<AuthUserRecord> {
  const normalizedEmail = normalizeEmail(seed.email);
  const existing = await authUserRepository.getByEmail(normalizedEmail);
  const timestamp = new Date().toISOString();

  if (existing) {
    return authUserRepository.save({
      ...existing,
      name: seed.name.trim(),
      provider: seed.provider,
      updatedAt: timestamp,
      lastLoginAt: timestamp
    });
  }

  return authUserRepository.save({
    userId: createUserId(normalizedEmail),
    email: normalizedEmail,
    name: seed.name.trim(),
    provider: seed.provider,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: timestamp
  });
}

async function updateLastLogin(user: AuthUserRecord): Promise<AuthUserRecord> {
  const updatedAt = new Date().toISOString();
  return authUserRepository.save({
    ...user,
    updatedAt,
    lastLoginAt: updatedAt
  });
}

export async function signupWithEmail(
  payload: EmailSignupPayload
): Promise<AuthSession> {
  const user = await createEmailUser(payload);
  return buildSession(user);
}

export async function loginWithEmail(
  payload: EmailLoginPayload
): Promise<AuthSession> {
  const user = await requireUserByEmail(payload.email);

  if (!user.passwordHash || user.passwordHash !== hashPassword(payload.password)) {
    throw new AuthModuleError(401, "Invalid email or password");
  }

  return buildSession(await updateLastLogin(user));
}

export async function loginWithProvider(
  payload: ProviderAuthPayload,
  provider: AuthProvider
): Promise<AuthSession> {
  const tokenSeed = payload.token.trim() || provider;
  const user = await upsertProviderUser({
    email: `${provider}.${tokenSeed}@jenix.local`,
    name: `${provider[0]!.toUpperCase()}${provider.slice(1)} User`,
    provider
  });

  return buildSession(user);
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  const claims = verifyRefreshToken(refreshToken.trim());
  const session = await authRefreshSessionRepository.get(claims.sessionId);

  if (!session || session.userId !== claims.sub || session.revokedAt) {
    throw new AuthModuleError(401, "Refresh session is invalid");
  }

  if (session.expiresAt <= new Date().toISOString()) {
    throw new AuthModuleError(401, "Refresh session has expired");
  }

  if (session.refreshTokenHash !== hashSecret(refreshToken.trim())) {
    throw new AuthModuleError(401, "Refresh session is invalid");
  }

  const revokedAt = new Date().toISOString();
  await authRefreshSessionRepository.save({
    ...session,
    revokedAt,
    updatedAt: revokedAt
  });

  const user = await updateLastLogin(await requireUserById(claims.sub));
  const issued = issueTokenPair({
    user
  });
  await persistRefreshSession(issued.refreshSession);
  return issued.tokenPair;
}

export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken?.trim()) {
    return;
  }

  const claims = verifyRefreshToken(refreshToken.trim());
  const session = await authRefreshSessionRepository.get(claims.sessionId);

  if (!session) {
    return;
  }

  await authRefreshSessionRepository.save({
    ...session,
    revokedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function getAuthenticatedUser(userId: string) {
  return toAuthenticatedUser(await requireUserById(userId));
}

export const authTesting = {
  async reset() {
    await authUserRepository.reset();
    await authRefreshSessionRepository.reset();
  }
};
