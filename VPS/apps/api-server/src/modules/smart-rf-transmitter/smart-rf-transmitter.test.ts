import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { handleRuntimeLegacyDeviceMessage } from "../../infrastructure/mqtt/runtime.handlers";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";

import { smartRfTransmitterTesting } from "./smart-rf-transmitter.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "smart-rf-transmitter-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-SRR433-C3-STX01",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      }
    });
}

describe("smart rf transmitter routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await smartRfTransmitterTesting.reset();
    await deviceUiRuntimeStore.reset();
  });

  it("saves a profile, composing the EV1527 code from remote id + button code", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Transmitter Owner",
      email: "transmitter-owner@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-srr-a0ec",
      pid: "JNX-SRR433-C3-STX01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const saveResponse = await request(createApp())
      .put("/api/v1/devices/JNX-SRR-A0EC/smart-rf-transmitter/profiles/7")
      .set(createAuthHeaders(owner))
      .send({ name: "Curtain Open", remoteIdHex: "1B672", buttonCode: 1 });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.data.profile.name).toBe("Curtain Open");
    expect(saveResponse.body.data.profile.rfCodeHex).toMatch(/^0x[0-9A-F]{6}$/);

    const listResponse = await request(createApp())
      .get("/api/v1/devices/JNX-SRR-A0EC/smart-rf-transmitter/profiles")
      .set(createAuthHeaders(owner));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
  });

  it("dispatches a trigger over the legacy per-action MQTT topic", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Transmitter Owner 2",
      email: "transmitter-owner-2@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-srr-b111",
      pid: "JNX-SRR433-C3-STX01",
      homeId,
      ownerUserId: owner.user.userId
    });
    await request(createApp())
      .put("/api/v1/devices/JNX-SRR-B111/smart-rf-transmitter/profiles/1")
      .set(createAuthHeaders(owner))
      .send({ name: "Pump", rfCodeHex: "0x91B672" });

    const publishedTopics: Array<{ topicRoot: string; deviceId: string; actionSuffix: string }> =
      [];
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand() {},
      async publishNotification() {},
      async publishOtaRequest() {},
      async publishLegacyDeviceCommand(input) {
        publishedTopics.push({
          topicRoot: input.topicRoot,
          deviceId: input.deviceId,
          actionSuffix: input.actionSuffix
        });
      }
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-SRR-B111/smart-rf-transmitter/trigger")
      .set(createAuthHeaders(owner))
      .send({ profileId: 1, action: "TRIGGER" });

    expect(response.status).toBe(200);
    expect(publishedTopics).toEqual([
      { topicRoot: "jenixone/v1/transmitters", deviceId: "JNX-SRR-B111", actionSuffix: "trigger" }
    ]);

    const logsResponse = await request(createApp())
      .get("/api/v1/devices/JNX-SRR-B111/smart-rf-transmitter/logs")
      .set(createAuthHeaders(owner));
    expect(logsResponse.body.data[0].action).toBe("TRIGGER_PROFILE");
  });

  it("rejects reboot from a non-owner/admin HOME member", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Transmitter Owner 3",
      email: "transmitter-owner-3@example.com"
    });
    const member = await createAuthenticatedSession({
      name: "Transmitter Member",
      email: "transmitter-member@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-srr-c222",
      pid: "JNX-SRR433-C3-STX01",
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
      .post("/api/v1/devices/JNX-SRR-C222/smart-rf-transmitter/reboot")
      .set(createAuthHeaders(member, { homeId }));

    expect(response.status).toBe(403);
  });

  it("returns 404 for a trigger against an unsaved profile", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Transmitter Owner 4",
      email: "transmitter-owner-4@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-srr-d333",
      pid: "JNX-SRR433-C3-STX01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-SRR-D333/smart-rf-transmitter/trigger")
      .set(createAuthHeaders(owner))
      .send({ profileId: 99 });

    expect(response.status).toBe(404);
  });

  it("routes a legacy availability/status/ack message into the device runtime and logs", async () => {
    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jenixone/v1/transmitters",
      deviceId: "JNX-SRR-E444",
      suffix: "availability",
      payload: "online"
    });

    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jenixone/v1/transmitters",
      deviceId: "JNX-SRR-E444",
      suffix: "status",
      payload: { wifiConnected: true, savedButtons: 3, productProfile: "GENERIC_RF_REMOTE" }
    });

    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jenixone/v1/transmitters",
      deviceId: "JNX-SRR-E444",
      suffix: "evt/ack",
      payload: { ok: true, requestId: "cmd-001", commandTopic: "jenixone/v1/transmitters/JNX-SRR-E444/cmd/trigger" }
    });

    const runtime = await deviceUiRuntimeStore.get("JNX-SRR-E444");
    expect(runtime?.telemetrySnapshot.telemetry.wifiConnected).toBe(true);
    expect(runtime?.telemetrySnapshot.telemetry.savedButtons).toBe(3);

    const logs = await import("./smart-rf-transmitter.model").then((mod) =>
      mod.smartRfLogRepository.listByDevice("JNX-SRR-E444")
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("ACK");
  });

  it("ignores legacy messages for other topic roots", async () => {
    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jenixone/v1/token-dispensers",
      deviceId: "JNX-TD-001",
      suffix: "status",
      payload: { wifiConnected: true }
    });

    const runtime = await deviceUiRuntimeStore.get("JNX-TD-001");
    expect(runtime?.telemetrySnapshot.telemetry.wifiConnected).toBeUndefined();
  });
});
