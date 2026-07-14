import "@testing-library/jest-dom/vitest";
import type { AuthSession } from "@jenix/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiUnauthorizedError,
  fetchAuthenticatedJson
} from "./authenticatedRequest";
import {
  authSessionExpiredEvent,
  createSessionState,
  readStoredSession,
  writeStoredSession
} from "./authSessionStorage";

const session: AuthSession = {
  user: {
    userId: "user-auth",
    name: "Auth User",
    email: "auth@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-auth",
      ownerUserId: "user-auth",
      name: "Auth Home",
      isDefault: true,
      role: "owner",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z"
    }
  ],
  activeHomeId: "home-auth",
  tokens: {
    accessToken: "header.initial.signature",
    refreshToken: "header.refresh.signature",
    expiresInSeconds: 120
  }
};

function jsonResponse<T>(status: number, data: T) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data })
  };
}

describe("fetchAuthenticatedJson", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    writeStoredSession(createSessionState(session));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("refreshes the session and retries after a 401 response", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "header.rotated.signature",
          refreshToken: "header.rotated-refresh.signature",
          expiresInSeconds: 900
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, ["device-1"]));

    const result = await fetchAuthenticatedJson<string[]>(
      "/api/v1/devices",
      session,
      {
        method: "GET",
        headers: { "X-Home-Id": "home-auth" }
      }
    );

    expect(result).toEqual(["device-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST" })
    );

    const retryHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    expect(retryHeaders.get("Authorization")).toBe(
      "Bearer header.rotated.signature"
    );
    expect(readStoredSession()?.session.tokens.accessToken).toBe(
      "header.rotated.signature"
    );
  });

  it("expires the stored session when refresh is unauthorized", async () => {
    const expiredListener = vi.fn();
    window.addEventListener(authSessionExpiredEvent, expiredListener);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(
      fetchAuthenticatedJson("/api/v1/devices", session, { method: "GET" })
    ).rejects.toBeInstanceOf(ApiUnauthorizedError);

    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(readStoredSession()).toBeNull();
    window.removeEventListener(authSessionExpiredEvent, expiredListener);
  });
});
