import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";

const ADMIN_KEY = "test-admin-key";
const DEVICE_KEY = "test-device-key";

describe("security gates (SEC-01 / SEC-02)", () => {
  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
    delete process.env.DEVICE_INGEST_KEY;
  });

  it("SEC-01 blocks the admin OTA surface without the admin key", async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;

    const response = await request(createApp())
      .post("/api/v1/admin/ota/releases")
      .set({ "x-role": "JENIX_DEVELOPER" })
      .send({});

    expect(response.status).toBe(401);
  });

  it("SEC-01 passes through (enforcement off) when no admin key is configured", async () => {
    // Safe live-migration default: the gate is inert until ADMIN_API_KEY is set.
    const response = await request(createApp())
      .get("/api/v1/admin/pids")
      .set({ "x-role": "JENIX_DEVELOPER" });

    expect(response.status).not.toBe(401);
  });

  it("SEC-02 blocks telemetry ingest without the device key", async () => {
    process.env.DEVICE_INGEST_KEY = DEVICE_KEY;

    const response = await request(createApp())
      .post("/api/v1/devices/any-device/telemetry")
      .send({ telemetry: { tankLevelMm: 500 } });

    expect(response.status).toBe(401);
  });

  it("SEC-02 accepts telemetry when the correct device key is supplied", async () => {
    process.env.DEVICE_INGEST_KEY = DEVICE_KEY;

    const response = await request(createApp())
      .post("/api/v1/devices/any-device/telemetry")
      .set({ "x-device-key": DEVICE_KEY })
      .send({ telemetry: { tankLevelMm: 500 } });

    // Passes the gate — no longer 401 (may be 4xx/2xx from the controller).
    expect(response.status).not.toBe(401);
  });
});
