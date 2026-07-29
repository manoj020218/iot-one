import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthModuleError } from "./auth.types";
import { verifyGoogleAccessToken } from "./auth.google";

const originalClientId = process.env.GOOGLE_CLIENT_ID;
const originalFetch = global.fetch;

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body)
  } as Response;
}

describe("verifyGoogleAccessToken", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "expected-client-id.apps.googleusercontent.com";
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalClientId;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects when GOOGLE_CLIENT_ID is not configured on the server", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(verifyGoogleAccessToken("some-token")).rejects.toMatchObject({
      statusCode: 503
    } satisfies Partial<AuthModuleError>);
  });

  it("rejects a token that was not issued for this app", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ aud: "someone-elses-client-id" })
    ) as unknown as typeof fetch;

    await expect(verifyGoogleAccessToken("stolen-token")).rejects.toMatchObject({
      statusCode: 401
    } satisfies Partial<AuthModuleError>);
  });

  it("rejects when the Google email is not verified", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ aud: "expected-client-id.apps.googleusercontent.com" })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sub: "google-user-1",
          email: "person@example.com",
          email_verified: false,
          name: "Person"
        })
      ) as unknown as typeof fetch;

    await expect(verifyGoogleAccessToken("token")).rejects.toMatchObject({
      statusCode: 401
    } satisfies Partial<AuthModuleError>);
  });

  it("returns the verified profile for a valid token", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ aud: "expected-client-id.apps.googleusercontent.com" })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sub: "google-user-1",
          email: "person@example.com",
          email_verified: true,
          name: "Person Example"
        })
      ) as unknown as typeof fetch;

    await expect(verifyGoogleAccessToken("token")).resolves.toEqual({
      email: "person@example.com",
      name: "Person Example",
      providerId: "google-user-1"
    });
  });
});
