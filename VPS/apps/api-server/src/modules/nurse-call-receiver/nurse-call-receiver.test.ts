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

import { nurseCallReceiverTesting, raiseCall } from "./nurse-call-receiver.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "nurse-call-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-RFNC-C3-01",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "0.1.0"
      }
    });
}

describe("nurse call receiver routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await nurseCallReceiverTesting.reset();
    await deviceUiRuntimeStore.reset();
  });

  it("saves and lists a learned remote", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Nurse Call Owner",
      email: "nurse-call-owner@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-rfnc-04c8",
      pid: "JNX-RFNC-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const saveResponse = await request(createApp())
      .post("/api/v1/devices/JNX-RFNC-04C8/nurse-call/remotes")
      .set(createAuthHeaders(owner))
      .send({ name: "Bed 12 Call", remoteType: 2, bedLabel: "BED-12" });

    expect(saveResponse.status).toBe(201);
    expect(saveResponse.body.data.name).toBe("Bed 12 Call");

    const listResponse = await request(createApp())
      .get("/api/v1/devices/JNX-RFNC-04C8/nurse-call/remotes")
      .set(createAuthHeaders(owner));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
  });

  it("raises a call, lists it as active, then attends it into history", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Nurse Call Owner 2",
      email: "nurse-call-owner-2@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-rfnc-1111",
      pid: "JNX-RFNC-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    await raiseCall("JNX-RFNC-1111", {
      remoteName: "Bed 12 Call",
      bedLabel: "BED-12",
      occurredAt: "2026-07-27T10:00:00.000Z"
    });

    const activeResponse = await request(createApp())
      .get("/api/v1/devices/JNX-RFNC-1111/nurse-call/calls/active")
      .set(createAuthHeaders(owner));

    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.data).toHaveLength(1);
    const callId = activeResponse.body.data[0].callId;

    const attendResponse = await request(createApp())
      .post(`/api/v1/devices/JNX-RFNC-1111/nurse-call/calls/${callId}/attend`)
      .set(createAuthHeaders(owner));

    expect(attendResponse.status).toBe(200);
    expect(attendResponse.body.data.status).toBe("attended");

    const historyResponse = await request(createApp())
      .get("/api/v1/devices/JNX-RFNC-1111/nurse-call/calls/history")
      .set(createAuthHeaders(owner));

    expect(historyResponse.body.data).toHaveLength(1);

    const stillActiveResponse = await request(createApp())
      .get("/api/v1/devices/JNX-RFNC-1111/nurse-call/calls/active")
      .set(createAuthHeaders(owner));

    expect(stillActiveResponse.body.data).toHaveLength(0);
  });

  it("dispatches attend_call over MQTT when a bridge is configured", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Nurse Call Owner 3",
      email: "nurse-call-owner-3@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-rfnc-2222",
      pid: "JNX-RFNC-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const publishedCommands: Array<{ command: string; pid: string }> = [];
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand(message) {
        publishedCommands.push({ command: message.command, pid: message.pid });
      },
      async publishNotification() {},
      async publishOtaRequest() {}
    });

    await raiseCall("JNX-RFNC-2222", { occurredAt: "2026-07-27T10:00:00.000Z" });
    const activeResponse = await request(createApp())
      .get("/api/v1/devices/JNX-RFNC-2222/nurse-call/calls/active")
      .set(createAuthHeaders(owner));
    const callId = activeResponse.body.data[0].callId;

    await request(createApp())
      .post(`/api/v1/devices/JNX-RFNC-2222/nurse-call/calls/${callId}/attend`)
      .set(createAuthHeaders(owner));

    expect(publishedCommands).toEqual([{ command: "attend_call", pid: "JNX-RFNC-C3-01" }]);
  });

  it("rejects factory_reset from a non-owner/admin HOME member", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Nurse Call Owner 4",
      email: "nurse-call-owner-4@example.com"
    });
    const member = await createAuthenticatedSession({
      name: "Nurse Call Member",
      email: "nurse-call-member@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-rfnc-3333",
      pid: "JNX-RFNC-C3-01",
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
      .post("/api/v1/devices/JNX-RFNC-3333/nurse-call/commands")
      .set(createAuthHeaders(member, { homeId }))
      .send({ command: "factory_reset" });

    expect(response.status).toBe(403);
  });

  it("allows refresh from any HOME member without a bridge configured", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Nurse Call Owner 5",
      email: "nurse-call-owner-5@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-rfnc-4444",
      pid: "JNX-RFNC-C3-01",
      homeId,
      ownerUserId: owner.user.userId
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-RFNC-4444/nurse-call/commands")
      .set(createAuthHeaders(owner))
      .send({ command: "refresh" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ dispatched: false });
  });

  it("routes a canonical-topic events message to raise a call", async () => {
    await handleRuntimeDeviceEventsMessage({
      tenantId: "home-1",
      pid: "JNX-RFNC-C3-01",
      deviceId: "JNX-RFNC-5555",
      payload: {
        eventType: "call_raised",
        remoteName: "Bed 3 Call",
        bedId: "BED-03"
      }
    });

    const calls = await request(createApp())
      .get("/api/v1/devices/JNX-RFNC-5555/nurse-call/calls/active")
      .set({});

    // No auth/home context on this request — only asserting the ingestion side
    // effect happened; access control is covered by the dedicated auth tests.
    expect(calls.status).toBe(401);

    const activeCalls = await import("./nurse-call-receiver.model").then((mod) =>
      mod.nurseCallRecordRepository.listByDevice("JNX-RFNC-5555", "active")
    );
    expect(activeCalls).toHaveLength(1);
    expect(activeCalls[0]?.remoteName).toBe("Bed 3 Call");
    expect(activeCalls[0]?.bedLabel).toBe("BED-03");
  });

  it("routes a canonical-topic status message into the device UI runtime snapshot", async () => {
    await handleRuntimeDeviceStatusMessage({
      tenantId: "home-1",
      pid: "JNX-RFNC-C3-01",
      deviceId: "JNX-RFNC-6666",
      payload: {
        pairedRemotes: 3,
        activeCalls: 1,
        mode: "sta",
        wifiConnected: true,
        mqttConnected: true
      }
    });

    const runtime = await deviceUiRuntimeStore.get("JNX-RFNC-6666");
    expect(runtime?.telemetrySnapshot.telemetry.pairedRemotes).toBe(3);
    expect(runtime?.telemetrySnapshot.telemetry.mode).toBe("sta");
  });

  it("ignores events/status messages for other PIDs", async () => {
    await handleRuntimeDeviceEventsMessage({
      tenantId: "home-1",
      pid: "JNX-TG-C3-001",
      deviceId: "JNX-TG-A7F2",
      payload: { eventType: "call_raised" }
    });

    const activeCalls = await import("./nurse-call-receiver.model").then((mod) =>
      mod.nurseCallRecordRepository.listByDevice("JNX-TG-A7F2", "active")
    );
    expect(activeCalls).toHaveLength(0);
  });
});
