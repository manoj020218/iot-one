import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import type { AuthSession } from "@jenix/shared";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthSessionContext, AuthSessionProvider } from "./AuthSessionProvider";

function AuthSessionTokenProbe() {
  const context = useContext(AuthSessionContext);

  if (!context?.session) {
    return <span>anonymous</span>;
  }

  return <span>{context.session.tokens.accessToken}</span>;
}

const refreshableSession: AuthSession = {
  user: {
    userId: "user-refresh",
    name: "Refresh User",
    email: "refresh@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-user-refresh",
      ownerUserId: "user-refresh",
      name: "HOME",
      isDefault: true,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
      role: "owner"
    }
  ],
  activeHomeId: "home-user-refresh",
  tokens: {
    accessToken: "header.initial.signature",
    refreshToken: "header.refresh.signature",
    expiresInSeconds: 120
  }
};

describe("AuthSessionProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          accessToken: "header.rotated.signature",
          refreshToken: "header.rotated-refresh.signature",
          expiresInSeconds: 900
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("refreshes structured bearer sessions before access-token expiry", async () => {
    render(
      <AuthSessionProvider initialSession={refreshableSession}>
        <AuthSessionTokenProbe />
      </AuthSessionProvider>
    );

    expect(screen.getByText("header.initial.signature")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_001);
    });

    expect(
      screen.getByText("header.rotated.signature")
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
