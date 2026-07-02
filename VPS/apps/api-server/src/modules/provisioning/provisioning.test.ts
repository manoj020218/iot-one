import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { provisioningTesting } from "./provisioning.service";

describe("provisioning routes", () => {
  beforeEach(() => {
    provisioningTesting.reset();
  });

  it("creates a provisioning intent and returns its status", async () => {
    const createResponse = await request(createApp())
      .post("/api/v1/provisioning/register-intent")
      .send({
        userId: "user-1",
        homeId: "home-user-1",
        method: "ble",
        pid: "JNX-TG-C3-001"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.method).toBe("ble");

    const statusResponse = await request(createApp()).get(
      `/api/v1/provisioning/status/${createResponse.body.data.provisioningId}`
    );

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.status).toBe("BLE_CONNECTED");
  });

  it("starts AP provisioning intents from the Wi-Fi handoff state", async () => {
    const createResponse = await request(createApp())
      .post("/api/v1/provisioning/register-intent")
      .send({
        userId: "user-2",
        homeId: "home-user-2",
        method: "ap",
        pid: "JNX-TG-C3-001"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe("WIFI_SENT");
  });
});
