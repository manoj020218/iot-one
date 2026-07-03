import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { handleRuntimeOtaAckMessage } from "../../infrastructure/mqtt/runtime.handlers";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";
import { createOtaDeliveryWorker } from "./ota.delivery-worker";
import { otaTesting } from "./ota.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "ota-worker-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-TG-C3-501",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      }
    });
}

async function createOtaRelease(version = "1.1.0") {
  await request(createApp())
    .post("/api/v1/admin/ota/releases")
    .set(developerHeaders)
    .send({
      releaseId: `TANK-HW10-STABLE-${version.replaceAll(".", "")}`,
      pid: "JNX-TG-C3-501",
      hardwareRevision: "HW1.0",
      version,
      channel: "stable",
      artifactUrl: `https://cdn.jenix.dev/fw/tank-guard-${version}.bin`,
      checksum: `checksum-${version}`,
      status: "published"
    });
}

describe("ota delivery worker", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await pidTesting.reset();
    await deviceTesting.reset();
    await otaTesting.reset();
  });

  it("publishes queued OTA delivery jobs and marks them dispatched", async () => {
    const publishedRequests: string[] = [];

    useRuntimeMqttBridge({
      async publishTelemetryIngress() {
        throw new Error("not used");
      },
      async publishScheduleTick() {
        throw new Error("not used");
      },
      async publishDeviceCommand() {
        throw new Error("not used");
      },
      async publishNotification() {
        throw new Error("not used");
      },
      async publishOtaRequest(message) {
        publishedRequests.push(message.requestId);
      }
    });

    await createPid();
    await createOtaRelease("1.1.0");
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7fa",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });

    const requestResponse = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7FA/firmware/request")
      .set(createAuthHeaders(ownerSession))
      .send({
        channel: "stable"
      });

    expect(requestResponse.status).toBe(200);

    const worker = createOtaDeliveryWorker({
      workerId: "ota-delivery-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const result = await worker.runOnce("2026-07-03T12:00:00.000Z");
    expect(result.claimedCount).toBe(1);
    expect(result.dispatchedCount).toBe(1);
    expect(publishedRequests).toEqual([requestResponse.body.data.requestId]);

    const jobs = await otaTesting.listDeliveryJobs("JNX-TG-A7FA");
    expect(jobs[0]?.status).toBe("dispatched");
    expect(jobs[0]?.dispatchedAt).toBe("2026-07-03T12:00:00.000Z");
  });

  it("retries dispatched OTA delivery jobs when acknowledgement does not arrive in time", async () => {
    const publishedRequests: string[] = [];

    useRuntimeMqttBridge({
      async publishTelemetryIngress() {
        throw new Error("not used");
      },
      async publishScheduleTick() {
        throw new Error("not used");
      },
      async publishDeviceCommand() {
        throw new Error("not used");
      },
      async publishNotification() {
        throw new Error("not used");
      },
      async publishOtaRequest(message) {
        publishedRequests.push(message.requestId);
      }
    });

    await createPid();
    await createOtaRelease("1.1.2");
    const ownerSession = await createAuthenticatedSession({
      name: "Retry Owner",
      email: "retry-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7fb",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });

    await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7FB/firmware/request")
      .set(createAuthHeaders(ownerSession))
      .send({
        channel: "stable"
      });

    const worker = createOtaDeliveryWorker({
      workerId: "ota-delivery-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const firstRun = await worker.runOnce("2026-07-03T12:10:00.000Z");
    expect(firstRun.dispatchedCount).toBe(1);

    const secondRun = await worker.runOnce("2026-07-03T12:10:35.000Z");
    expect(secondRun.dispatchedCount).toBe(1);
    expect(publishedRequests).toHaveLength(2);
  });

  it("marks OTA jobs completed on acknowledgement and updates device firmware version", async () => {
    const publishedRequests: string[] = [];

    useRuntimeMqttBridge({
      async publishTelemetryIngress() {
        throw new Error("not used");
      },
      async publishScheduleTick() {
        throw new Error("not used");
      },
      async publishDeviceCommand() {
        throw new Error("not used");
      },
      async publishNotification() {
        throw new Error("not used");
      },
      async publishOtaRequest(message) {
        publishedRequests.push(message.requestId);
      }
    });

    await createPid();
    await createOtaRelease("1.2.0");
    const ownerSession = await createAuthenticatedSession({
      name: "Ack Owner",
      email: "ack-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7fc",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });

    const requestResponse = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7FC/firmware/request")
      .set(createAuthHeaders(ownerSession))
      .send({
        channel: "stable",
        targetVersion: "1.2.0"
      });

    const worker = createOtaDeliveryWorker({
      workerId: "ota-delivery-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    await worker.runOnce("2026-07-03T12:20:00.000Z");
    expect(publishedRequests).toHaveLength(1);

    await handleRuntimeOtaAckMessage({
      requestId: requestResponse.body.data.requestId,
      deviceId: "JNX-TG-A7FC",
      acknowledgedAt: "2026-07-03T12:20:08.000Z",
      status: "completed",
      appliedVersion: "1.2.0"
    });

    const jobs = await otaTesting.listDeliveryJobs("JNX-TG-A7FC");
    expect(jobs[0]?.status).toBe("completed");
    expect(jobs[0]?.acknowledgedAt).toBe("2026-07-03T12:20:08.000Z");

    const deviceResponse = await request(createApp())
      .get("/api/v1/devices/JNX-TG-A7FC")
      .set(createAuthHeaders(ownerSession));

    expect(deviceResponse.status).toBe(200);
    expect(deviceResponse.body.data.firmwareVersion).toBe("1.2.0");
  });
});
