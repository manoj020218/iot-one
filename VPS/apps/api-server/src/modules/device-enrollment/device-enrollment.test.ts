import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";
import { createAuthenticatedSession } from "../../test-support/auth";
import { resetDeviceCredentialStore } from "./device-enrollment.model";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "device-enrollment-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-TG-C3-601",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      }
    });
}

describe("device enrollment route", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    resetDeviceCredentialStore();
  });

  it("404s for a device that has not been registered yet", async () => {
    const response = await request(createApp()).post(
      "/api/v1/devices/JNX-TG-UNREGISTERED/enrollment"
    );

    expect(response.status).toBe(404);
  });

  it("issues cloud/MQTT config once the device is registered, and is idempotent", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Enrollment Owner",
      email: "enrollment-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;

    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-e001",
      pid: "JNX-TG-C3-601",
      homeId,
      ownerUserId: ownerSession.user.userId
    });

    const first = await request(createApp()).post(
      "/api/v1/devices/JNX-TG-E001/enrollment"
    );

    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      homeId,
      mqttHost: expect.any(String),
      mqttPort: expect.any(Number),
      mqttUsername: "JNX-TG-E001"
    });
    expect(typeof first.body.data.mqttPassword).toBe("string");
    expect(first.body.data.mqttPassword.length).toBeGreaterThan(0);

    const second = await request(createApp()).post(
      "/api/v1/devices/JNX-TG-E001/enrollment"
    );

    expect(second.status).toBe(200);
    expect(second.body.data.mqttUsername).toBe(first.body.data.mqttUsername);
    expect(second.body.data.mqttPassword).toBe(first.body.data.mqttPassword);
  });
});
