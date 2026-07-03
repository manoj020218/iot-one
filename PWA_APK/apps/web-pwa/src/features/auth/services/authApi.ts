import {
  ensureDefaultHome,
  type AuthProvider,
  type AuthSession,
  type TokenPair
} from "@jenix/shared";

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
    throw new Error(`Request failed with status ${response.status}`);
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
  } catch {
    void payload.password;
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
  } catch {
    void payload.password;
    return createSession(payload.email, payload.name, "email");
  }
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
  } catch {
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
