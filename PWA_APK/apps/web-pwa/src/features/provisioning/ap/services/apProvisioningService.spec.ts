import type { AuthSession } from "@jenix/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { provisioningApiTesting } from "../../services/provisioningApi";
import { provisionApDevice } from "./apProvisioningService";

const session: AuthSession = {
  user: {
    userId: "user-ap-test",
    name: "Installer",
    email: "installer@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-ap-test",
    refreshToken: "refresh-ap-test",
    expiresInSeconds: 900
  }
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

describe("provisionApDevice", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    provisioningApiTesting.reset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("POSTs credentials to the device's SoftAP gateway and registers the device once it confirms Wi-Fi", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith("http://192.168.4.1")) {
        return Promise.resolve(
          jsonResponse({ ok: true, wifi_connected: true, ip: "192.168.1.55" })
        );
      }

      return Promise.reject(new Error("no backend in test env"));
    }) as unknown as typeof fetch;

    const statuses: string[] = [];
    const result = await provisionApDevice({
      session,
      wifi: { ssid: "HomeNet", password: "secret123" },
      onStatusChange: (status) => statuses.push(status)
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://192.168.4.1/provision",
      expect.objectContaining({ method: "POST" })
    );
    expect(statuses).toEqual([
      "WIFI_SENT",
      "DEVICE_CONNECTING_WIFI",
      "DEVICE_REGISTERED",
      "SUCCESS"
    ]);
    expect(result.deviceId).toMatch(/^JNX-TG-C3-/);
  });

  it("throws without registering anything when the device rejects the Wi-Fi credentials", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith("http://192.168.4.1")) {
        return Promise.resolve(jsonResponse({ ok: true, wifi_connected: false, ip: "" }));
      }

      return Promise.reject(new Error("no backend in test env"));
    }) as unknown as typeof fetch;

    await expect(
      provisionApDevice({
        session,
        wifi: { ssid: "HomeNet", password: "wrongpassword" }
      })
    ).rejects.toThrow(/could not join/);
  });

  it("throws a clear error when the SoftAP gateway is unreachable (phone not on the device hotspot)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as unknown as typeof fetch;

    await expect(
      provisionApDevice({
        session,
        wifi: { ssid: "HomeNet", password: "secret123" }
      })
    ).rejects.toThrow("network error");
  });
});
