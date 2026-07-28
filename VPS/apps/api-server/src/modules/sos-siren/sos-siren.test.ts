import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { handleRuntimeDeviceStatusMessage } from "../../infrastructure/mqtt/runtime.handlers";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { deviceUiRuntimeStore } from "../devices/device-ui-runtime.model";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";

import { sosSirenTesting } from "./sos-siren.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "sos-siren-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-SOS-C3-001",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.2.0"
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
    pid: "JNX-SOS-C3-001",
    homeId,
    ownerUserId: owner.user.userId
  });
  return { owner, homeId };
}

describe("sos siren routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await sosSirenTesting.reset();
    await deviceUiRuntimeStore.reset();
  });

  it("dispatches trigger_alarm/stop_alarm over the canonical MQTT command topic", async () => {
    await createPid();
    const { owner } = await registerOwnerAndDevice("jnx-sos-a001", "SOS Owner");

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

    const triggerResponse = await request(createApp())
      .post("/api/v1/devices/JNX-SOS-A001/sos-siren/trigger")
      .set(createAuthHeaders(owner))
      .send({ reason: "flood_warning" });
    expect(triggerResponse.status).toBe(200);

    const stopResponse = await request(createApp())
      .post("/api/v1/devices/JNX-SOS-A001/sos-siren/stop")
      .set(createAuthHeaders(owner));
    expect(stopResponse.status).toBe(200);

    expect(publishedCommands).toEqual([
      { command: "trigger_alarm", pid: "JNX-SOS-C3-001", payload: { reason: "flood_warning" } },
      { command: "stop_alarm", pid: "JNX-SOS-C3-001" }
    ]);

    const logsResponse = await request(createApp())
      .get("/api/v1/devices/JNX-SOS-A001/sos-siren/logs")
      .set(createAuthHeaders(owner));
    expect(logsResponse.body.data.map((entry: { action: string }) => entry.action)).toEqual([
      "stopAlarm",
      "triggerAlarm"
    ]);
  });

  it("maps select-profile onto apply_settings with a select_profile action payload", async () => {
    await createPid();
    const { owner } = await registerOwnerAndDevice("jnx-sos-b002", "SOS Owner 2");

    const publishedCommands: Array<{ command: string; payload?: unknown }> = [];
    useRuntimeMqttBridge({
      async publishTelemetryIngress() {},
      async publishScheduleTick() {},
      async publishDeviceCommand(message) {
        publishedCommands.push({
          command: message.command,
          ...(message.payload ? { payload: message.payload } : {})
        });
      },
      async publishNotification() {},
      async publishOtaRequest() {}
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-SOS-B002/sos-siren/select-profile")
      .set(createAuthHeaders(owner))
      .send({ id: 3 });

    expect(response.status).toBe(200);
    expect(publishedCommands).toEqual([
      { command: "apply_settings", payload: { action: "select_profile", id: 3 } }
    ]);
  });

  it("rejects speaker-profile and factory-reset from a non-owner/admin HOME member", async () => {
    await createPid();
    const { owner, homeId } = await registerOwnerAndDevice("jnx-sos-c003", "SOS Owner 3");
    const member = await createAuthenticatedSession({
      name: "SOS Member",
      email: "sos-member@example.com"
    });

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(owner))
      .send({ role: "member" });
    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(member, { homeId }))
      .send({ code: shareCodeResponse.body.data.code });

    const speakerResponse = await request(createApp())
      .post("/api/v1/devices/JNX-SOS-C003/sos-siren/speaker-profile")
      .set(createAuthHeaders(member, { homeId }))
      .send({ id: 1 });
    expect(speakerResponse.status).toBe(403);

    const factoryResponse = await request(createApp())
      .post("/api/v1/devices/JNX-SOS-C003/sos-siren/factory-reset")
      .set(createAuthHeaders(member, { homeId }));
    expect(factoryResponse.status).toBe(403);
  });

  it("allows trigger_alarm from any HOME member without a bridge configured", async () => {
    await createPid();
    const { owner } = await registerOwnerAndDevice("jnx-sos-d004", "SOS Owner 4");

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-SOS-D004/sos-siren/trigger")
      .set(createAuthHeaders(owner));

    expect(response.status).toBe(200);
    expect(response.body.data.deliveryId).toBeTruthy();
  });

  it("routes a canonical-topic status message into the device UI runtime snapshot", async () => {
    await handleRuntimeDeviceStatusMessage({
      tenantId: "home-1",
      pid: "JNX-SOS-C3-001",
      deviceId: "JNX-SOS-E005",
      payload: {
        sirenState: "ALARM",
        sosActive: true,
        sosPressCount: 2,
        activeDutyPercent: 62,
        selectedProfileId: 4
      }
    });

    const runtime = await deviceUiRuntimeStore.get("JNX-SOS-E005");
    expect(runtime?.telemetrySnapshot.telemetry.sirenState).toBe("ALARM");
    expect(runtime?.telemetrySnapshot.telemetry.sosActive).toBe(true);
    expect(runtime?.telemetrySnapshot.telemetry.sosPressCount).toBe(2);
  });

  it("ignores status messages for other PIDs", async () => {
    await handleRuntimeDeviceStatusMessage({
      tenantId: "home-1",
      pid: "JNX-TG-C3-001",
      deviceId: "JNX-SOS-F006",
      payload: { sirenState: "ALARM" }
    });

    const runtime = await deviceUiRuntimeStore.get("JNX-SOS-F006");
    expect(runtime).toBeUndefined();
  });
});
