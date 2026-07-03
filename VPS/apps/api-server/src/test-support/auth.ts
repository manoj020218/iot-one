import type { AuthSession } from "@jenix/shared";

import { signupWithEmail } from "../modules/auth/auth.service";

export async function createAuthenticatedSession(input?: {
  name?: string;
  email?: string;
  password?: string;
}): Promise<AuthSession> {
  return signupWithEmail({
    name: input?.name ?? "Test User",
    email: input?.email ?? "test.user@example.com",
    password: input?.password ?? "Password123!"
  });
}

export function createAuthHeaders(
  session: AuthSession,
  options?: {
    homeId?: string;
  }
): Record<string, string> {
  const homeId = options?.homeId ?? session.activeHomeId;

  return {
    Authorization: `Bearer ${session.tokens.accessToken}`,
    ...(homeId ? { "x-home-id": homeId } : {})
  };
}
