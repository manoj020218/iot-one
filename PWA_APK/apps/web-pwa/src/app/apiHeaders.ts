import type { AuthSession } from "@jenix/shared";

export function createAuthenticatedHeaders(
  session: AuthSession,
  options?: {
    contentType?: "application/json";
    homeId?: string;
  }
): HeadersInit {
  return {
    Authorization: `Bearer ${session.tokens.accessToken}`,
    ...(options?.contentType ? { "Content-Type": options.contentType } : {}),
    ...(options?.homeId ? { "x-home-id": options.homeId } : {})
  };
}
