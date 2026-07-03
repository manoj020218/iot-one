import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { useRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import {
  handleRuntimeOtaAckMessage,
  handleRuntimeTelemetryIngressMessage
} from "../../infrastructure/mqtt/runtime.handlers";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "./device.service";
import { homeTesting } from "../homes/home.service";
import { otaTesting } from "../ota/ota.service";
import { pidTesting } from "../pid/pid.service";
import { createSceneRuntimeEvaluationWorker } from "../scenes/scene.runtime-worker";
import { sceneTesting } from "../scenes/scene.service";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "device-tests"
};

async function shareHomeAccess(
  ownerHeaders: Record<string, string>,
  homeId: string,
  role: "member" | "viewer",
  invitedSessionHeaders: Record<string, string>
) {
  const shareCodeResponse = await request(createApp())
    .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
    .set(ownerHeaders)
    .send({ role });

  expect(shareCodeResponse.status).toBe(201);

  const redeemResponse = await request(createApp())
    .post("/api/v1/homes/redeem")
    .set(invitedSessionHeaders)
    .send({
      code: shareCodeResponse.body.data.code
    });

  expect(redeemResponse.status).toBe(200);
}

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

async function createOtaRelease(input?: Partial<{
  releaseId: string;
  pid: string;
  hardwareRevision: string;
  version: string;
  channel: "stable" | "beta";
}>) {
  await request(createApp())
    .post("/api/v1/admin/ota/releases")
    .set(developerHeaders)
    .send({
      releaseId: input?.releaseId ?? "TANK-HW10-STABLE-100",
      pid: input?.pid ?? "JNX-TG-C3-501",
      hardwareRevision: input?.hardwareRevision ?? "HW1.0",
      version: input?.version ?? "1.0.0",
      channel: input?.channel ?? "stable",
      artifactUrl: "https://cdn.jenix.dev/fw/tank-guard-1.0.0.bin",
      checksum: "abc123checksum",
      status: "published"
    });
}

describe("device routes", () => {
  beforeEach(async () => {
    useRuntimeMqttBridge(null);
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await otaTesting.reset();
    await sceneTesting.reset();
  });

  it("registers a device against an existing PID", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;

    const response = await request(createApp())
      .post("/api/v1/devices/register")
      .send({
        deviceId: "jnx-tg-a7f2",
        pid: "JNX-TG-C3-501",
        homeId,
        ownerUserId: ownerSession.user.userId,
        firmwareVersion: "1.0.0"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.pid).toBe("JNX-TG-C3-501");
    expect(response.body.data.deviceId).toBe("JNX-TG-A7F2");
    expect(response.body.data.displayName).toBe("Smart Tank Guard");
  });

  it("renames a registered device for its owner", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f3",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F3/rename")
      .set(createAuthHeaders(ownerSession))
      .send({
        displayName: "Main Tank"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe("Main Tank");
  });

  it("allows a shared HOME member to rename a device inside the same HOME", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const memberSession = await createAuthenticatedSession({
      name: "Shared Member",
      email: "shared-member@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f5",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId
    });
    await shareHomeAccess(
      createAuthHeaders(ownerSession),
      homeId,
      "member",
      createAuthHeaders(memberSession, { homeId })
    );

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F5/rename")
      .set(createAuthHeaders(memberSession, { homeId }))
      .send({
        displayName: "Shared Tank"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe("Shared Tank");
  });

  it("queues a firmware request for a writable HOME role", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const memberSession = await createAuthenticatedSession({
      name: "Writable Member",
      email: "writable-member@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await createOtaRelease({
      releaseId: "TANK-HW10-STABLE-110",
      version: "1.1.0"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f6",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });
    await shareHomeAccess(
      createAuthHeaders(ownerSession),
      homeId,
      "member",
      createAuthHeaders(memberSession, { homeId })
    );

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F6/firmware/request")
      .set(createAuthHeaders(memberSession, { homeId }))
      .send({
        channel: "stable"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("queued");
    expect(response.body.data.targetVersion).toBe("1.1.0");
  });

  it("queues an OTA delivery job for firmware rollout execution", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await createOtaRelease({
      releaseId: "TANK-HW10-STABLE-111",
      version: "1.1.1"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f6b",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F6B/firmware/request")
      .set(createAuthHeaders(ownerSession))
      .send({
        channel: "stable",
        targetVersion: "1.1.1"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("queued");
    expect(response.body.data.requestId).toBeTruthy();
    expect(response.body.data.deliveryState).toBe("queued");

    const queuedJobs = await otaTesting.listDeliveryJobs("JNX-TG-A7F6B");
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0]?.targetVersion).toBe("1.1.1");
    expect(queuedJobs[0]?.status).toBe("queued");
  });

  it("lists firmware rollout history for an accessible device", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Rollout Owner",
      email: "rollout-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await createOtaRelease({
      releaseId: "TANK-HW10-STABLE-113",
      version: "1.1.3"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f6c",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });

    const requestResponse = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F6C/firmware/request")
      .set(createAuthHeaders(ownerSession))
      .send({
        channel: "stable",
        targetVersion: "1.1.3"
      });

    const listResponse = await request(createApp())
      .get("/api/v1/devices/JNX-TG-A7F6C/firmware/rollouts")
      .set(createAuthHeaders(ownerSession));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].requestId).toBe(requestResponse.body.data.requestId);
    expect(listResponse.body.data[0].status).toBe("queued");
  });

  it("replays a failed firmware rollout as a new queued delivery job", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Replay Owner",
      email: "replay-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await createOtaRelease({
      releaseId: "TANK-HW10-STABLE-114",
      version: "1.1.4"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f6d",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });

    const requestResponse = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F6D/firmware/request")
      .set(createAuthHeaders(ownerSession))
      .send({
        channel: "stable",
        targetVersion: "1.1.4"
      });
    const failedRequestId = requestResponse.body.data.requestId as string;

    await handleRuntimeOtaAckMessage({
      requestId: failedRequestId,
      deviceId: "JNX-TG-A7F6D",
      acknowledgedAt: "2026-07-03T13:10:00.000Z",
      status: "failed",
      errorMessage: "Checksum mismatch"
    });

    const replayResponse = await request(createApp())
      .post(`/api/v1/devices/JNX-TG-A7F6D/firmware/rollouts/${encodeURIComponent(failedRequestId)}/replay`)
      .set(createAuthHeaders(ownerSession));

    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body.data.status).toBe("queued");
    expect(replayResponse.body.data.replayedFromRequestId).toBe(failedRequestId);

    const rolloutHistory = await otaTesting.listDeliveryJobs("JNX-TG-A7F6D");
    expect(rolloutHistory).toHaveLength(2);
    expect(rolloutHistory[0]?.status).toBe("failed");
    expect(rolloutHistory[1]?.status).toBe("queued");
    expect(rolloutHistory[1]?.replayedFromRequestId).toBe(failedRequestId);
  });

  it("rejects firmware requests from a viewer role", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const viewerSession = await createAuthenticatedSession({
      name: "View Only User",
      email: "view-only@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await createOtaRelease();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f7",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "0.9.0"
    });
    await shareHomeAccess(
      createAuthHeaders(ownerSession),
      homeId,
      "viewer",
      createAuthHeaders(viewerSession, { homeId })
    );

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F7/firmware/request")
      .set(createAuthHeaders(viewerSession, { homeId }))
      .send({
        channel: "stable"
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/firmware/i);
  });

  it("resolves the correct OTA release by PID and hardware revision", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp())
      .post("/api/v1/admin/pids")
      .set(developerHeaders)
      .send({
        ...foundationPidBlueprint,
        pid: "JNX-TG-C3-601",
        status: "beta",
        api: {
          enabled: false,
          sellable: false,
          allowedScopes: []
        },
        firmware: {
          ...foundationPidBlueprint.firmware,
          stableVersion: "2.0.0"
        }
      });
    await createOtaRelease({
      releaseId: "TANK-HW10-STABLE-120",
      pid: "JNX-TG-C3-501",
      hardwareRevision: "HW1.0",
      version: "1.2.0"
    });
    await createOtaRelease({
      releaseId: "TANK-HW20-STABLE-190",
      pid: "JNX-TG-C3-501",
      hardwareRevision: "HW2.0",
      version: "1.9.0"
    });
    await createOtaRelease({
      releaseId: "TANK2-HW10-STABLE-200",
      pid: "JNX-TG-C3-601",
      hardwareRevision: "HW1.0",
      version: "2.0.0"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f8",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId,
      firmwareVersion: "1.0.0",
      hardwareRevision: "HW1.0"
    });

    const response = await request(createApp())
      .get("/api/v1/devices/JNX-TG-A7F8/firmware-plan")
      .set(createAuthHeaders(ownerSession));

    expect(response.status).toBe(200);
    expect(response.body.data.stable.release.version).toBe("1.2.0");
    expect(response.body.data.stable.release.pid).toBe("JNX-TG-C3-501");
    expect(response.body.data.stable.release.hardwareRevision).toBe("HW1.0");
    expect(response.body.data.recommendedChannel).toBe("stable");
  });

  it("ingests telemetry and queues matching device-threshold scene evaluation", async () => {
    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f4",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId
    });
    await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Tank Level Alert",
        status: "active",
        triggers: [
          {
            type: "device_threshold",
            deviceId: "JNX-TG-A7F4",
            metricKey: "tankLevelPct",
            comparator: "gte",
            threshold: 80
          }
        ],
        conditions: [
          {
            field: "tankLevelPct",
            operator: "gte",
            value: 80
          }
        ],
        actions: [
          {
            type: "notification",
            message: "Tank level is high"
          }
        ]
      });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F4/telemetry")
      .send({
        telemetry: {
          tankLevelPct: 81
        },
        mqttStatus: "online",
        cloudStatus: "online",
        localStatus: "available",
        occurredAt: "2026-07-02T06:00:00.000Z"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.device.lastSeenAt).toBe("2026-07-02T06:00:00.000Z");
    expect(response.body.data.device.mqttStatus).toBe("online");
    expect(response.body.data.sceneRuntimeQueue.acceptedCount).toBe(1);

    const worker = createSceneRuntimeEvaluationWorker({
      workerId: "scene-runtime-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const workerResult = await worker.runOnce("2026-07-02T06:00:05.000Z");
    expect(workerResult.matchedRunCount).toBe(1);
    expect(workerResult.runCount).toBe(1);
  });

  it("publishes telemetry to MQTT ingress and lets the consumer enqueue runtime work", async () => {
    const telemetryMessages: Parameters<typeof handleRuntimeTelemetryIngressMessage>[0][] =
      [];

    useRuntimeMqttBridge({
      async publishTelemetryIngress(message) {
        telemetryMessages.push(message);
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
      async publishOtaRequest() {
        throw new Error("not used");
      }
    });

    await createPid();
    const ownerSession = await createAuthenticatedSession({
      name: "Device Owner",
      email: "device-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f9",
      pid: "JNX-TG-C3-501",
      homeId,
      ownerUserId: ownerSession.user.userId
    });
    const sceneResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "MQTT Tank Level Alert",
        status: "active",
        triggers: [
          {
            type: "device_threshold",
            deviceId: "JNX-TG-A7F9",
            metricKey: "tankLevelPct",
            comparator: "gte",
            threshold: 80
          }
        ],
        conditions: [
          {
            field: "tankLevelPct",
            operator: "gte",
            value: 80
          }
        ],
        actions: [
          {
            type: "notification",
            message: "Tank level is high"
          }
        ]
      });

    expect(sceneResponse.status).toBe(201);

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F9/telemetry")
      .send({
        telemetry: {
          tankLevelPct: 88
        },
        mqttStatus: "online",
        occurredAt: "2026-07-03T08:00:00.000Z"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.sceneRuntimeQueue.acceptedCount).toBe(1);
    expect(telemetryMessages).toHaveLength(1);
    expect((await sceneTesting.listEvaluationJobs(homeId)).length).toBe(0);

    await handleRuntimeTelemetryIngressMessage(telemetryMessages[0]!);
    expect((await sceneTesting.listEvaluationJobs(homeId)).length).toBe(1);

    const worker = createSceneRuntimeEvaluationWorker({
      workerId: "scene-runtime-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const workerResult = await worker.runOnce("2026-07-03T08:00:05.000Z");
    expect(workerResult.matchedRunCount).toBe(1);
    expect(workerResult.runCount).toBe(1);
  });
});
