import {
  ensureDefaultHome,
  type AuthProvider,
  type AuthSession,
  type TokenPair
} from "@jenix/shared";

import { ApiResponseError, shouldUseDemoFallback } from "../../../app/authenticatedRequest";

const authEndpoint = "/api/v1/auth";

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

function createSession(
  email: string,
  name: string,
  provider: AuthProvider
): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const userId = createUserId(normalizedEmail);
  const homes = ensureDefaultHome([], userId);

  return Promise.resolve({
    user: {
      userId,
      email: normalizedEmail,
      name: name.trim(),
      provider
    },
    homes,
    activeHomeId: homes[0]!.homeId,
    tokens: createTokenPair(userId)
  });
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new ApiResponseError(response.status);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export async function loginWithEmail(payload: {
  email: string;
  password: string;
}) {
  try {
    return await fetchJson<AuthSession>(`${authEndpoint}/email/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    const name = payload.email.split("@")[0] ?? "Jenix User";
    return createSession(payload.email, name, "email");
  }
}

export async function signupWithEmail(payload: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    return await fetchJson<AuthSession>(`${authEndpoint}/email/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return createSession(payload.email, payload.name, "email");
  }
}

export async function loginWithGoogle(accessToken: string): Promise<AuthSession> {
  return fetchJson<AuthSession>(`${authEndpoint}/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ accessToken })
  });
}

/**
 * Native Google Sign-In (Capacitor's GoogleSignIn plugin) yields an ID token,
 * not an OAuth access token like the web popup flow above -- see
 * nativeGoogleSignIn.ts and PROVISIONING.md-adjacent notes in AuthPage.tsx
 * for why the native app needs a different credential type.
 */
export async function loginWithGoogleIdToken(idToken: string): Promise<AuthSession> {
  return fetchJson<AuthSession>(`${authEndpoint}/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken })
  });
}

export async function loginWithProvider(provider: AuthProvider) {
  try {
    return await fetchJson<AuthSession>(`${authEndpoint}/${provider}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: provider
      })
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    const email = `${provider}@jenix.local`;
    const name = `${provider[0]!.toUpperCase()}${provider.slice(1)} User`;
    return createSession(email, name, provider);
  }
}

export async function logoutSession(session: AuthSession | null): Promise<void> {
  if (!session) {
    return;
  }

  try {
    await fetch(`${authEndpoint}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken: session.tokens.refreshToken
      })
    });
  } catch {
    return;
  }
}

export type AuthSessionRefreshResult =
  | {
      status: "success";
      tokens: TokenPair;
    }
  | {
      status: "unauthorized";
    }
  | {
      status: "unavailable";
    };

export async function refreshAuthSession(
  session: AuthSession
): Promise<AuthSessionRefreshResult> {
  try {
    const response = await fetch(`${authEndpoint}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken: session.tokens.refreshToken
      })
    });

    if (response.status === 401) {
      return {
        status: "unauthorized"
      };
    }

    if (!response.ok) {
      return {
        status: "unavailable"
      };
    }

    const payload = (await response.json()) as { data: TokenPair };
    return {
      status: "success",
      tokens: payload.data
    };
  } catch {
    return {
      status: "unavailable"
    };
  }
}
