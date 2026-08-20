import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";
import { tokenDispenserTesting, buildTokenDispenserTopic } from "../token-dispenser/token-dispenser.service";

import { billingDispenserLicenseRepository } from "./billing-dispenser.model";
import { billingDispenserTesting, useSubscriptionChecker } from "./billing-dispenser.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "billing-dispenser-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-BD-S3-01",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      }
    });
}

async function registerDeviceForOwner(deviceId: string) {
  const owner = await createAuthenticatedSession({
    name: `Billing Dispenser Owner ${deviceId}`,
    email: `billing-dispenser-owner-${deviceId.toLowerCase()}@example.com`
  });
  const homeId = owner.activeHomeId!;
  await request(createApp()).post("/api/v1/devices/register").send({
    deviceId,
    pid: "JNX-BD-S3-01",
    homeId,
    ownerUserId: owner.user.userId
  });
  return owner;
}

describe("billing dispenser routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await tokenDispenserTesting.reset(); // shared connection/log store
    await billingDispenserTesting.reset(); // also resets the subscription checker override below
    await deviceUiRuntimeStore.reset();
    useSubscriptionChecker(async () => true); // active by default — tests that want inactive override explicitly
  });

  it("dispatches PRINT_CUSTOM_JSON to the device's real command topic with a composed kitchen ticket", async () => {
    await createPid();
    const owner = await registerDeviceForOwner("JNX-BD-A001");
    await billingDispenserLicenseRepository.save({ deviceId: "JNX-BD-A001", licenseKey: "test-key" });

    const publishedRaw: Array<{ topic: string; payload: unknown }> = [];
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand() {},
      async publishNotification() {},
      async publishOtaRequest() {},
      async publishRaw(topic, payload) {
        publishedRaw.push({ topic, payload });
      }
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-BD-A001/billing-dispenser/print-custom")
      .set(createAuthHeaders(owner))
      .send({
        ticketType: "kitchen",
        tableNumber: 7,
        items: [{ name: "Butter Chicken", qty: 2 }, { name: "Garlic Naan", qty: 3, note: "extra crispy" }]
      });

    expect(response.status).toBe(200);
    expect(publishedRaw).toHaveLength(1);
    expect(publishedRaw[0]?.topic).toBe(
      buildTokenDispenserTopic("default", "default", "JNX-BD-A001", "command")
    );

    const payload = publishedRaw[0]?.payload as { command: string; payload: string };
    expect(payload.command).toBe("PRINT_CUSTOM_JSON");
    const elements = JSON.parse(payload.payload).elements;
    expect(elements).toContainEqual({ type: "text", content: "TABLE 7", align: 1, bold: true, double_height: true });
    expect(elements).toContainEqual({ type: "text", content: "2x  Butter Chicken", align: 0 });
    expect(elements).toContainEqual({ type: "text", content: "   (extra crispy)", align: 0 });
    // No amount anywhere on a kitchen ticket
    expect(JSON.stringify(elements)).not.toMatch(/Rs |TOTAL/);
  });

  it("composes a bill ticket with prices and a total, and requires total in the request", async () => {
    await createPid();
    const owner = await registerDeviceForOwner("JNX-BD-B002");
    await billingDispenserLicenseRepository.save({ deviceId: "JNX-BD-B002", licenseKey: "test-key" });
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand() {},
      async publishNotification() {},
      async publishOtaRequest() {},
      async publishRaw() {}
    });

    const missingTotal = await request(createApp())
      .post("/api/v1/devices/JNX-BD-B002/billing-dispenser/print-custom")
      .set(createAuthHeaders(owner))
      .send({ ticketType: "bill", tableNumber: 3, items: [{ name: "Dal Makhani", qty: 1, price: 220 }] });
    expect(missingTotal.status).toBe(400);

    const ok = await request(createApp())
      .post("/api/v1/devices/JNX-BD-B002/billing-dispenser/print-custom")
      .set(createAuthHeaders(owner))
      .send({
        ticketType: "bill",
        tableNumber: 3,
        header: "Test Hotel",
        items: [{ name: "Dal Makhani", qty: 1, price: 220 }],
        total: 259.6
      });
    expect(ok.status).toBe(200);
  });

  it("blocks printing and logs it when the device's subscription is inactive", async () => {
    await createPid();
    const owner = await registerDeviceForOwner("JNX-BD-C003");
    await billingDispenserLicenseRepository.save({ deviceId: "JNX-BD-C003", licenseKey: "expired-key" });
    useSubscriptionChecker(async () => false);

    const publishedRaw: Array<{ topic: string; payload: unknown }> = [];
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand() {},
      async publishNotification() {},
      async publishOtaRequest() {},
      async publishRaw(topic, payload) {
        publishedRaw.push({ topic, payload });
      }
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-BD-C003/billing-dispenser/print-custom")
      .set(createAuthHeaders(owner))
      .send({ ticketType: "kitchen", tableNumber: 1, items: [{ name: "Tea", qty: 1 }] });

    expect(response.status).toBe(402);
    expect(publishedRaw).toHaveLength(0); // never reached the bridge

    const logsResponse = await request(createApp())
      .get("/api/v1/devices/JNX-BD-C003/token-dispenser/logs") // shared log store, same product family
      .set(createAuthHeaders(owner));
    expect(logsResponse.body.data[0].action).toBe("PRINT_BLOCKED_SUBSCRIPTION");
  });

  it("blocks printing when no license key was ever provisioned for the device", async () => {
    await createPid();
    const owner = await registerDeviceForOwner("JNX-BD-D004");
    // No billingDispenserLicenseRepository.save() call — device has no license key on file.

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-BD-D004/billing-dispenser/print-custom")
      .set(createAuthHeaders(owner))
      .send({ ticketType: "kitchen", tableNumber: 1, items: [{ name: "Tea", qty: 1 }] });

    expect(response.status).toBe(402);
  });

  it("rejects a user with no relationship to the device's HOME", async () => {
    await createPid();
    await registerDeviceForOwner("JNX-BD-E005");
    await billingDispenserLicenseRepository.save({ deviceId: "JNX-BD-E005", licenseKey: "test-key" });

    const stranger = await createAuthenticatedSession({
      name: "Unrelated User",
      email: "unrelated-user@example.com"
    });
    const response = await request(createApp())
      .post("/api/v1/devices/JNX-BD-E005/billing-dispenser/print-custom")
      .set(createAuthHeaders(stranger))
      .send({ ticketType: "kitchen", tableNumber: 1, items: [{ name: "Tea", qty: 1 }] });

    expect(response.status).toBe(403);
  });
});
