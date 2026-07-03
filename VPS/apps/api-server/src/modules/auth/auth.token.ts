import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { AuthProvider, TokenPair } from "@jenix/shared";

import type { AuthRefreshSessionRecord, AuthUserRecord } from "./auth.model";

interface TokenHeader {
  alg: "HS256";
  typ: "JWT";
}

interface TokenBaseClaims {
  sub: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

export interface AccessTokenClaims extends TokenBaseClaims {
  type: "access";
  name: string;
  email: string;
  provider: AuthProvider;
}

export interface RefreshTokenClaims extends TokenBaseClaims {
  type: "refresh";
  sessionId: string;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAccessTokenSecret() {
  return process.env.JWT_ACCESS_SECRET?.trim() || "change_me";
}

function getRefreshTokenSecret() {
  return process.env.JWT_REFRESH_SECRET?.trim() || "change_me";
}

function getAccessTokenLifetimeSeconds() {
  return 900;
}

function getRefreshTokenLifetimeSeconds() {
  return 60 * 60 * 24 * 30;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signClaims<T extends TokenBaseClaims>(claims: T, secret: string): string {
  const header: TokenHeader = {
    alg: "HS256",
    typ: "JWT"
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = signPayload(signingInput, secret);
  return `${signingInput}.${signature}`;
}

function verifyTokenSignature(token: string, secret: string): string {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [encodedHeader, encodedClaims, signature] = parts;

  if (!encodedHeader || !encodedClaims || !signature) {
    throw new Error("Invalid token format");
  }

  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const expectedSignature = signPayload(signingInput, secret);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid token signature");
  }

  return decodeBase64Url(encodedClaims);
}

function parseTokenClaims<T extends TokenBaseClaims>(
  token: string,
  secret: string,
  expectedType: T["type"]
): T {
  const rawClaims = verifyTokenSignature(token, secret);
  const claims = JSON.parse(rawClaims) as Partial<T>;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    typeof claims.sub !== "string" ||
    claims.type !== expectedType ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number"
  ) {
    throw new Error("Invalid token payload");
  }

  if (claims.exp <= nowSeconds) {
    throw new Error("Token has expired");
  }

  return claims as T;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return parseTokenClaims<AccessTokenClaims>(
    token,
    getAccessTokenSecret(),
    "access"
  );
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const claims = parseTokenClaims<RefreshTokenClaims>(
    token,
    getRefreshTokenSecret(),
    "refresh"
  );

  if (typeof claims.sessionId !== "string" || !claims.sessionId) {
    throw new Error("Invalid refresh token payload");
  }

  return claims;
}

export function buildRefreshSessionExpiry(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function issueTokenPair(input: {
  user: AuthUserRecord;
}): {
  tokenPair: TokenPair;
  refreshSession: AuthRefreshSessionRecord;
} {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessTokenExpiresInSeconds = getAccessTokenLifetimeSeconds();
  const refreshTokenExpiresInSeconds = getRefreshTokenLifetimeSeconds();
  const sessionId = randomUUID();

  const accessToken = signClaims<AccessTokenClaims>(
    {
      sub: input.user.userId,
      type: "access",
      iat: nowSeconds,
      exp: nowSeconds + accessTokenExpiresInSeconds,
      name: input.user.name,
      email: input.user.email,
      provider: input.user.provider
    },
    getAccessTokenSecret()
  );
  const refreshToken = signClaims<RefreshTokenClaims>(
    {
      sub: input.user.userId,
      type: "refresh",
      iat: nowSeconds,
      exp: nowSeconds + refreshTokenExpiresInSeconds,
      sessionId
    },
    getRefreshTokenSecret()
  );
  const nowIso = new Date().toISOString();

  return {
    tokenPair: {
      accessToken,
      refreshToken,
      expiresInSeconds: accessTokenExpiresInSeconds
    },
    refreshSession: {
      sessionId,
      userId: input.user.userId,
      refreshTokenHash: hashSecret(refreshToken),
      expiresAt: buildRefreshSessionExpiry(refreshTokenExpiresInSeconds),
      createdAt: nowIso,
      updatedAt: nowIso
    }
  };
}
