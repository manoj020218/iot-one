import type { AuthProvider, AuthSession } from "@jenix/shared";

export interface EmailLoginPayload {
  email: string;
  password: string;
}

export interface EmailSignupPayload extends EmailLoginPayload {
  name: string;
}

export interface ProviderAuthPayload {
  token: string;
}

/**
 * accessToken: the web PWA's popup-based Google Identity Services flow.
 * idToken: the native app's real Google Sign-In (Play Services), used
 * instead since GIS's popup never renders inside a Capacitor WebView. See
 * PWA_APK/apps/android's GoogleSignInPlugin.java.
 */
export type GoogleAuthPayload =
  | { accessToken: string; idToken?: undefined }
  | { idToken: string; accessToken?: undefined };

export interface AuthSessionResponse {
  data: AuthSession;
}

export interface AuthProviderSessionSeed {
  email: string;
  name: string;
  provider: AuthProvider;
}

export interface AuthenticatedRequestUser {
  userId: string;
  name: string;
  email: string;
  provider: AuthProvider;
}

export class AuthModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AuthModuleError";
  }
}
