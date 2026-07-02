import {
  ensureDefaultHome,
  type AuthProvider,
  type AuthSession,
  type TokenPair
} from "@jenix/shared";

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

export function loginWithEmail(payload: { email: string; password: string }) {
  void payload.password;
  const name = payload.email.split("@")[0] ?? "Jenix User";
  return createSession(payload.email, name, "email");
}

export function signupWithEmail(payload: {
  name: string;
  email: string;
  password: string;
}) {
  void payload.password;
  return createSession(payload.email, payload.name, "email");
}

export function loginWithProvider(provider: AuthProvider) {
  const email = `${provider}@jenix.local`;
  const name = `${provider[0]!.toUpperCase()}${provider.slice(1)} User`;
  return createSession(email, name, provider);
}
