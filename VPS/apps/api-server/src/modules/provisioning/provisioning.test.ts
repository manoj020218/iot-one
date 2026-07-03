import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "../auth/auth.service";
import { provisioningTesting } from "./provisioning.service";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";

describe("provisioning routes", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await provisioningTesting.reset();
  });

  it("creates a provisioning intent and returns its status", async () => {
    const session = await createAuthenticatedSession({
      email: "prov-user-1@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/provisioning/register-intent")
      .set(createAuthHeaders(session))
      .send({
        method: "ble",
        pid: "JNX-TG-C3-001"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.method).toBe("ble");

    const statusResponse = await request(createApp()).get(
      `/api/v1/provisioning/status/${createResponse.body.data.provisioningId}`
    )
      .set(createAuthHeaders(session));

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.status).toBe("BLE_CONNECTED");
  });

  it("starts AP provisioning intents from the Wi-Fi handoff state", async () => {
    const session = await createAuthenticatedSession({
      email: "prov-user-2@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/provisioning/register-intent")
      .set(createAuthHeaders(session))
      .send({
        method: "ap",
        pid: "JNX-TG-C3-001"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe("WIFI_SENT");
  });
});
