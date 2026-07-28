import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { handleRuntimeRawMessage } from "../../infrastructure/mqtt/runtime.handlers";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";

import { tokenDispenserLogRepository } from "./token-dispenser.model";
import { buildTokenDispenserTopic, tokenDispenserTesting } from "./token-dispenser.service";

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

  it("builds the device's real jenix/{tenant}/{site}/{device}/command topic on dispatch", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Token Dispenser Owner",
      email: "token-dispenser-owner@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-td-a001",
      pid: "JNX-TD-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

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
      .post("/api/v1/devices/JNX-TD-A001/token-dispenser/print-next")
      .set(createAuthHeaders(owner));

    expect(response.status).toBe(200);
    expect(publishedRaw).toHaveLength(1);
    expect(publishedRaw[0]?.topic).toBe(
      buildTokenDispenserTopic("default", "default", "JNX-TD-A001", "command")
    );
    expect(publishedRaw[0]?.payload).toMatchObject({ command: "PRINT_NEXT_TOKEN" });

    const logsResponse = await request(createApp())
      .get("/api/v1/devices/JNX-TD-A001/token-dispenser/logs")
      .set(createAuthHeaders(owner));
    expect(logsResponse.body.data[0].action).toBe("PRINT_NEXT_TOKEN");
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

  it("routes a raw telemetry/state/event message for the device's real topic shape", async () => {
    const topic = buildTokenDispenserTopic("acme", "site-1", "JNX-TD-D004", "telemetry");
    await handleRuntimeRawMessage(
      topic,
      Buffer.from(
        JSON.stringify({
          currentToken: 42,
          paperLow: false,
          estimatedTokensLeft: 458
        })
      )
    );

    const runtime = await deviceUiRuntimeStore.get("JNX-TD-D004");
    expect(runtime?.telemetrySnapshot.telemetry.currentToken).toBe(42);
    expect(runtime?.telemetrySnapshot.telemetry.estimatedTokensLeft).toBe(458);

    const eventTopic = buildTokenDispenserTopic("acme", "site-1", "JNX-TD-D004", "event");
    await handleRuntimeRawMessage(
      eventTopic,
      Buffer.from(JSON.stringify({ command_id: "cmd-1", success: true }))
    );

    const logs = await tokenDispenserLogRepository.listByDevice("JNX-TD-D004");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("ACK");
  });

  it("ignores raw messages that don't match the token dispenser topic shape", async () => {
    await handleRuntimeRawMessage(
      "some/unrelated/topic/state",
      Buffer.from(JSON.stringify({ wifiConnected: true }))
    );

    const runtime = await deviceUiRuntimeStore.get("UNRELATED");
    expect(runtime).toBeUndefined();
  });
});
