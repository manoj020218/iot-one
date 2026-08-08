import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginWithEmail, signupWithEmail } from "./authApi";

function jsonResponse(status: number, data: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data, error: data })
  };
}

describe("authApi login/signup — must not fabricate a session on rejected credentials", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("rejects with an error when the server returns 401 for wrong credentials, instead of logging in with a fabricated session", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, "Invalid email or password"));

    await expect(
      loginWithEmail({ email: "nobody@example.com", password: "wrong" })
    ).rejects.toBeTruthy();
  });

  it("rejects with an error when signup is refused (e.g. duplicate email), instead of fabricating a fake account", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, "Email already registered"));

    await expect(
      signupWithEmail({ name: "Someone", email: "taken@example.com", password: "Password123!" })
    ).rejects.toBeTruthy();
  });

  it("still falls back to a local demo session when the server is genuinely unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const session = await loginWithEmail({ email: "offline@example.com", password: "anything" });

    expect(session.user.email).toBe("offline@example.com");
  });
});
