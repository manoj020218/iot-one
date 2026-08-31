import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import {
  handleRuntimeDeviceEventsMessage,
  handleRuntimeDeviceStatusMessage
} from "../../infrastructure/mqtt/runtime.handlers";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";

import { tokenDispenserLogRepository } from "./token-dispenser.model";
import { tokenDispenserTesting } from "./token-dispenser.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "token-dispenser-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-TD-C3-01",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      }
    });
}

async function registerOwnerAndDevice(deviceId: string, ownerLabel: string) {
  const owner = await createAuthenticatedSession({
    name: ownerLabel,
    email: `${ownerLabel.toLowerCase().replace(/\s+/g, "-")}@example.com`
  });
  const homeId = owner.activeHomeId!;
  await request(createApp()).post("/api/v1/devices/register").send({
    deviceId,
    pid: "JNX-TD-C3-01",
    homeId,
    ownerUserId: owner.user.userId
  });
  return { owner, homeId };
}

describe("token dispenser routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await tokenDispenserTesting.reset();
    await deviceUiRuntimeStore.reset();
  });

  it("dispatches print/reset commands over the canonical MQTT command topic", async () => {
    await createPid();
    const { owner } = await registerOwnerAndDevice("jnx-td-a001", "Token Dispenser Owner");

    const publishedCommands: Array<{ command: string; pid: string; payload?: unknown }> = [];
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand(message) {
        publishedCommands.push({
          command: message.command,
          pid: message.pid,
          ...(message.payload ? { payload: message.payload } : {})
        });
      },
      async publishNotification() {},
      async publishOtaRequest() {}
    });

    const printResponse = await request(createApp())
      .post("/api/v1/devices/JNX-TD-A001/token-dispenser/print-next")
      .set(createAuthHeaders(owner));
    expect(printResponse.status).toBe(200);

    const resetResponse = await request(createApp())
      .post("/api/v1/devices/JNX-TD-A001/token-dispenser/reset-roll")
      .set(createAuthHeaders(owner));
    expect(resetResponse.status).toBe(200);

    expect(publishedCommands).toEqual([
      { command: "PRINT_NEXT_TOKEN", pid: "JNX-TD-C3-01" },
      { command: "RESET_ROLL_COUNTER", pid: "JNX-TD-C3-01" }
    ]);

    const logsResponse = await request(createApp())
      .get("/api/v1/devices/JNX-TD-A001/token-dispenser/logs")
      .set(createAuthHeaders(owner));
    expect(logsResponse.body.data[0].action).toBe("RESET_ROLL_COUNTER");
  });

  it("saves and returns a custom print template", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Token Dispenser Owner 2",
      email: "token-dispenser-owner-2@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-td-b002",
      pid: "JNX-TD-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const saveResponse = await request(createApp())
      .put("/api/v1/devices/JNX-TD-B002/token-dispenser/template")
      .set(createAuthHeaders(owner))
      .send({
        header: "CLINIC QUEUE",
        queueName: "Reception",
        tokenPrefix: "B",
        showDateTime: true,
        showQr: false,
        qrPayload: "",
        footer: "Thank you"
      });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.data.template.header).toBe("CLINIC QUEUE");

    const getResponse = await request(createApp())
      .get("/api/v1/devices/JNX-TD-B002/token-dispenser/template")
      .set(createAuthHeaders(owner));
    expect(getResponse.body.data.tokenPrefix).toBe("B");
  });

  it("rejects factory-reset from a non-owner/admin HOME member", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Token Dispenser Owner 3",
      email: "token-dispenser-owner-3@example.com"
    });
    const member = await createAuthenticatedSession({
      name: "Token Dispenser Member",
      email: "token-dispenser-member@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-td-c003",
      pid: "JNX-TD-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(owner))
      .send({ role: "member" });
    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(member, { homeId }))
      .send({ code: shareCodeResponse.body.data.code });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TD-C003/token-dispenser/factory-reset")
      .set(createAuthHeaders(member, { homeId }));

    expect(response.status).toBe(403);
  });

  it("routes a canonical-topic status message into the device UI runtime snapshot", async () => {
    await handleRuntimeDeviceStatusMessage({
      tenantId: "home-1",
      pid: "JNX-TD-C3-01",
      deviceId: "JNX-TD-D004",
      payload: {
        currentToken: 42,
        paperLow: false,
        estimatedTokensLeft: 458
      }
    });

    const runtime = await deviceUiRuntimeStore.get("JNX-TD-D004");
    expect(runtime?.telemetrySnapshot.telemetry.currentToken).toBe(42);
    expect(runtime?.telemetrySnapshot.telemetry.estimatedTokensLeft).toBe(458);
  });

  it("logs a device-initiated events message (button/local web UI) but skips mqtt-sourced ones", async () => {
    await createApp(); // populates the registerDeviceEventHandler registry

    await handleRuntimeDeviceEventsMessage({
      tenantId: "home-1",
      pid: "JNX-TD-C3-01",
      deviceId: "JNX-TD-E005",
      payload: { eventType: "print_next_token", occurredAt: "2026-08-31T00:00:00Z", source: "button" }
    });
    await handleRuntimeDeviceEventsMessage({
      tenantId: "home-1",
      pid: "JNX-TD-C3-01",
      deviceId: "JNX-TD-E005",
      payload: { eventType: "print_next_token", occurredAt: "2026-08-31T00:00:01Z", source: "mqtt" }
    });

    const logs = await tokenDispenserLogRepository.listByDevice("JNX-TD-E005");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("print_next_token");
    expect(logs[0]?.source).toBe("BUTTON");
  });

  it("ignores status/events messages for other PIDs", async () => {
    await handleRuntimeDeviceStatusMessage({
      tenantId: "home-1",
      pid: "JNX-TG-C3-001",
      deviceId: "UNRELATED",
      payload: { wifiConnected: true }
    });

    const runtime = await deviceUiRuntimeStore.get("UNRELATED");
    expect(runtime).toBeUndefined();
  });
});
