import { AuthModuleError } from "./auth.types";

export interface VerifiedGoogleProfile {
  email: string;
  name: string;
  providerId: string;
}

interface GoogleTokenInfo {
  aud?: string;
  azp?: string;
  exp?: string;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

interface GoogleIdTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
}

function configuredGoogleClientId(): string | undefined {
  const value = process.env.GOOGLE_CLIENT_ID?.trim();
  return value && value.length > 0 ? value : undefined;
}

/**
 * Verifies a Google OAuth access token obtained client-side via Google
 * Identity Services' implicit token flow. Two calls to Google are required:
 * `tokeninfo` proves the token was actually issued for *this* app (checking
 * `aud`/`azp` against GOOGLE_CLIENT_ID guards against a token minted for some
 * unrelated Google-integrated app being replayed against our login endpoint),
 * and `userinfo` returns the verified profile (email/name) tied to that token.
 */
export async function verifyGoogleAccessToken(
  accessToken: string
): Promise<VerifiedGoogleProfile> {
  const expectedClientId = configuredGoogleClientId();

  if (!expectedClientId) {
    throw new AuthModuleError(503, "Google sign-in is not configured on this server");
  }

  const trimmedToken = accessToken.trim();

  if (!trimmedToken) {
    throw new AuthModuleError(400, "Missing Google access token");
  }

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(trimmedToken)}`
  );

  if (!tokenInfoResponse.ok) {
    throw new AuthModuleError(401, "Invalid Google access token");
  }

  const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfo;
  const audience = tokenInfo.aud ?? tokenInfo.azp;

  if (audience !== expectedClientId) {
    throw new AuthModuleError(401, "Google access token was not issued for this app");
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${trimmedToken}`
    }
  });

  if (!userInfoResponse.ok) {
    throw new AuthModuleError(401, "Unable to load the Google account profile");
  }

  const profile = (await userInfoResponse.json()) as GoogleUserInfo;

  if (!profile.email || profile.email_verified === false) {
    throw new AuthModuleError(401, "Google account email is not verified");
  }

  return {
    email: profile.email,
    name: profile.name?.trim() || profile.email.split("@")[0]!,
    providerId: profile.sub
  };
}

/**
 * Verifies a Google ID token obtained natively (Play Services Sign-In on the
 * Capacitor app) -- see PWA_APK/apps/android's GoogleSignInPlugin.java for
 * why the native app uses a different credential type than the web PWA's
 * access-token flow above. tokeninfo's id_token variant returns the token's
 * verified claims directly (no separate userinfo call needed), and reports
 * email_verified as the string "true"/"false" rather than a real boolean.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
  const expectedClientId = configuredGoogleClientId();

  if (!expectedClientId) {
    throw new AuthModuleError(503, "Google sign-in is not configured on this server");
  }

  const trimmedToken = idToken.trim();

  if (!trimmedToken) {
    throw new AuthModuleError(400, "Missing Google ID token");
  }

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(trimmedToken)}`
  );

  if (!tokenInfoResponse.ok) {
    throw new AuthModuleError(401, "Invalid Google ID token");
  }

  const tokenInfo = (await tokenInfoResponse.json()) as GoogleIdTokenInfo;

  if (tokenInfo.aud !== expectedClientId) {
    throw new AuthModuleError(401, "Google ID token was not issued for this app");
  }

  if (!tokenInfo.email || String(tokenInfo.email_verified) !== "true") {
    throw new AuthModuleError(401, "Google account email is not verified");
  }

  if (!tokenInfo.sub) {
    throw new AuthModuleError(401, "Google ID token is missing a subject claim");
  }

  return {
    email: tokenInfo.email,
    name: tokenInfo.name?.trim() || tokenInfo.email.split("@")[0]!,
    providerId: tokenInfo.sub
  };
}
