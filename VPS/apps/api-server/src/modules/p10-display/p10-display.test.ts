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

import { p10DisplayLogRepository } from "./p10-display.model";
import { buildP10DisplayTopic, p10DisplayTesting } from "./p10-display.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "p10-display-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-P10-C3-01",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      }
    });
}

describe("p10 display routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await p10DisplayTesting.reset();
    await deviceUiRuntimeStore.reset();
  });

  it("builds the device's real jenix/v1/{homeId}/{deviceId}/command topic on dispatch", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "P10 Display Owner",
      email: "p10-display-owner@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-p10-a001",
      pid: "JNX-P10-C3-01",
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
      .post("/api/v1/devices/JNX-P10-A001/p10-display/set-token")
      .set(createAuthHeaders(owner))
      .send({ token: 15, counter: 2, announce: true });

    expect(response.status).toBe(200);
    expect(publishedRaw).toHaveLength(1);
    expect(publishedRaw[0]?.topic).toBe(
      buildP10DisplayTopic(homeId, "JNX-P10-A001", "command")
    );
    expect(publishedRaw[0]?.payload).toMatchObject({
      cmd: "setToken",
      token: 15,
      counter: 2,
      announce: true
    });

    const logsResponse = await request(createApp())
      .get("/api/v1/devices/JNX-P10-A001/p10-display/logs")
      .set(createAuthHeaders(owner));
    expect(logsResponse.body.data[0].action).toBe("setToken");
  });

  it("rejects an invalid brightness value", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "P10 Display Owner 2",
      email: "p10-display-owner-2@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-p10-b002",
      pid: "JNX-P10-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-P10-B002/p10-display/set-brightness")
      .set(createAuthHeaders(owner))
      .send({ brightness: 150 });

    expect(response.status).toBe(400);
  });

  it("rejects factory-reset from a non-owner/admin HOME member", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "P10 Display Owner 3",
      email: "p10-display-owner-3@example.com"
    });
    const member = await createAuthenticatedSession({
      name: "P10 Display Member",
      email: "p10-display-member@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-p10-c003",
      pid: "JNX-P10-C3-01",
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
      .post("/api/v1/devices/JNX-P10-C003/p10-display/factory-reset")
      .set(createAuthHeaders(member, { homeId }));

    expect(response.status).toBe(403);
  });

  it("routes a raw telemetry/command-ack message for the device's real topic shape", async () => {
    const topic = buildP10DisplayTopic("home-acme", "JNX-P10-D004", "telemetry");
    await handleRuntimeRawMessage(
      topic,
      Buffer.from(
        JSON.stringify({
          currentToken: 15,
          currentCounter: 2,
          displayMode: "TOKEN",
          wifiRssi: -55
        })
      )
    );

    const runtime = await deviceUiRuntimeStore.get("JNX-P10-D004");
    expect(runtime?.telemetrySnapshot.telemetry.currentToken).toBe(15);
    expect(runtime?.telemetrySnapshot.telemetry.displayMode).toBe("TOKEN");

    const ackTopic = buildP10DisplayTopic("home-acme", "JNX-P10-D004", "command/ack");
    await handleRuntimeRawMessage(
      ackTopic,
      Buffer.from(JSON.stringify({ requestId: "req-1", ok: true, reason: "token_set" }))
    );

    const logs = await p10DisplayLogRepository.listByDevice("JNX-P10-D004");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("ACK");
    expect(logs[0]?.requestId).toBe("req-1");
  });

  it("ignores raw messages that don't match the p10 display topic shape", async () => {
    await handleRuntimeRawMessage(
      "some/unrelated/topic/state",
      Buffer.from(JSON.stringify({ wifiConnected: true }))
    );

    const runtime = await deviceUiRuntimeStore.get("UNRELATED");
    expect(runtime).toBeUndefined();
  });
});
