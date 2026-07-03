import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "../auth/auth.service";
import { homeTesting } from "../homes/home.service";
import { createSceneActionDispatchWorker } from "./scene.action-worker";
import { sceneTesting } from "./scene.service";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";

async function shareHomeAccess(
  ownerHeaders: Record<string, string>,
  homeId: string,
  role: "member" | "viewer",
  memberHeaders: Record<string, string>
) {
  const shareCodeResponse = await request(createApp())
    .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
    .set(ownerHeaders)
    .send({ role });

  expect(shareCodeResponse.status).toBe(201);

  const redeemResponse = await request(createApp())
    .post("/api/v1/homes/redeem")
    .set(memberHeaders)
    .send({
      code: shareCodeResponse.body.data.code
    });

  expect(redeemResponse.status).toBe(200);
}

describe("scene routes", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await sceneTesting.reset();
  });

  it("creates and lists scenes for the current HOME", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "High Tank Alert",
        status: "active",
        triggers: [
          {
            type: "device_threshold",
            deviceId: "JNX-TG-C3-A7F2",
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
            message: "Tank level crossed 80%"
          }
        ]
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.name).toBe("High Tank Alert");

    const listResponse = await request(createApp())
      .get("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
  });

  it("runs a scene manually when telemetry conditions match", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Sync On High Level",
        status: "active",
        triggers: [
          {
            type: "manual"
          }
        ],
        conditions: [
          {
            field: "tankLevelPct",
            operator: "gte",
            value: 90
          }
        ],
        actions: [
          {
            type: "device_command",
            deviceId: "JNX-TG-C3-A7F2",
            command: "sync"
          }
        ]
      });

    const sceneId = createResponse.body.data.sceneId as string;

    const runResponse = await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(ownerSession))
      .send({
        telemetry: {
          tankLevelPct: 94
        }
      });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body.data.matchedConditions).toBe(true);
    expect(runResponse.body.data.executedActions).toHaveLength(1);
    expect(runResponse.body.data.scene.lastRunStatus).toBe("success");
  });

  it("blocks restricted scene commands for non-owner roles", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    const memberSession = await createAuthenticatedSession({
      name: "Scene Member",
      email: "scene-member@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await shareHomeAccess(
      createAuthHeaders(ownerSession),
      homeId,
      "member",
      createAuthHeaders(memberSession, { homeId })
    );

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Restricted Recovery Scene",
        status: "active",
        triggers: [
          {
            type: "manual"
          }
        ],
        conditions: [],
        actions: [
          {
            type: "device_command",
            deviceId: "JNX-TG-C3-A7F2",
            command: "factory_reset"
          }
        ]
      });

    const sceneId = createResponse.body.data.sceneId as string;

    const runResponse = await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(memberSession, { homeId }))
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Restricted scene command");
  });

  it("blocks restricted Matter scene commands for non-owner roles", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    const memberSession = await createAuthenticatedSession({
      name: "Scene Member",
      email: "scene-member@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await shareHomeAccess(
      createAuthHeaders(ownerSession),
      homeId,
      "member",
      createAuthHeaders(memberSession, { homeId })
    );

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Restricted Matter Scene",
        status: "active",
        triggers: [
          {
            type: "manual"
          }
        ],
        conditions: [],
        actions: [
          {
            type: "device_command",
            deviceId: "JNX-TG-C3-A7F2",
            command: "matter_commission"
          }
        ]
      });

    const sceneId = createResponse.body.data.sceneId as string;

    const runResponse = await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(memberSession, { homeId }))
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Restricted scene command");
  });

  it("blocks viewer access from manually running a scene", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    const viewerSession = await createAuthenticatedSession({
      name: "Scene Viewer",
      email: "scene-viewer@example.com"
    });
    const homeId = ownerSession.activeHomeId!;
    await shareHomeAccess(
      createAuthHeaders(ownerSession),
      homeId,
      "viewer",
      createAuthHeaders(viewerSession, { homeId })
    );

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Viewer Read Only Scene",
        status: "active",
        triggers: [
          {
            type: "manual"
          }
        ],
        conditions: [],
        actions: [
          {
            type: "notification",
            message: "Viewer should not run this"
          }
        ]
      });

    const sceneId = createResponse.body.data.sceneId as string;

    const runResponse = await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(viewerSession, { homeId }))
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Viewer access");
  });

  it("evaluates active device-threshold scenes from telemetry runtime events", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Tank Alert Runtime",
        status: "active",
        triggers: [
          {
            type: "device_threshold",
            deviceId: "JNX-TG-C3-A7F2",
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
            message: "Tank level crossed 80%"
          }
        ]
      });

    const runtimeResponse = await request(createApp())
      .post("/api/v1/scenes/runtime/device-threshold")
      .set(createAuthHeaders(ownerSession))
      .send({
        deviceId: "JNX-TG-C3-A7F2",
        telemetry: {
          tankLevelPct: 82
        },
        occurredAt: "2026-07-02T03:30:00.000Z"
      });

    expect(runtimeResponse.status).toBe(200);
    expect(runtimeResponse.body.data.evaluatedSceneCount).toBe(1);
    expect(runtimeResponse.body.data.matchedRunCount).toBe(1);
    expect(runtimeResponse.body.data.runs[0].scene.lastRunStatus).toBe("success");
  });

  it("dedupes schedule runtime evaluation for the same schedule window", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Morning Sync",
        status: "active",
        triggers: [
          {
            type: "schedule"
          }
        ],
        conditions: [],
        actions: [
          {
            type: "device_command",
            deviceId: "JNX-TG-C3-A7F2",
            command: "sync"
          }
        ],
        schedule: {
          timezone: "Asia/Kolkata",
          daysOfWeek: [4],
          time: "09:15"
        }
      });

    const firstRunResponse = await request(createApp())
      .post("/api/v1/scenes/runtime/schedule")
      .set(createAuthHeaders(ownerSession))
      .send({
        occurredAt: "2026-07-02T03:45:00.000Z"
      });

    expect(firstRunResponse.status).toBe(200);
    expect(firstRunResponse.body.data.evaluatedSceneCount).toBe(1);
    expect(firstRunResponse.body.data.runs).toHaveLength(1);

    const secondRunResponse = await request(createApp())
      .post("/api/v1/scenes/runtime/schedule")
      .set(createAuthHeaders(ownerSession))
      .send({
        occurredAt: "2026-07-02T03:45:00.000Z"
      });

    expect(secondRunResponse.status).toBe(200);
    expect(secondRunResponse.body.data.evaluatedSceneCount).toBe(0);
    expect(secondRunResponse.body.data.runs).toHaveLength(0);
  });

  it("returns run history for a scene after runtime execution", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Owner",
      email: "scene-owner@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "History Alert",
        status: "active",
        triggers: [
          {
            type: "device_threshold",
            deviceId: "JNX-TG-C3-A7F2",
            metricKey: "tankLevelPct",
            comparator: "gte",
            threshold: 70
          }
        ],
        conditions: [],
        actions: [
          {
            type: "notification",
            message: "History capture alert"
          }
        ]
      });

    const sceneId = createResponse.body.data.sceneId as string;

    await request(createApp())
      .post("/api/v1/scenes/runtime/device-threshold")
      .set(createAuthHeaders(ownerSession))
      .send({
        deviceId: "JNX-TG-C3-A7F2",
        telemetry: {
          tankLevelPct: 75
        }
      });

    const historyResponse = await request(createApp())
      .get(`/api/v1/scenes/${sceneId}/history`)
      .set(createAuthHeaders(ownerSession));

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data).toHaveLength(1);
    expect(historyResponse.body.data[0].source).toBe("device_threshold");
    expect(historyResponse.body.data[0].matchedConditions).toBe(true);
  });

  it("lists scene dispatch jobs after a failed worker delivery", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Dispatch Owner",
      email: "dispatch-owner@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Dispatch History Scene",
        status: "active",
        triggers: [{ type: "manual" }],
        conditions: [],
        actions: [
          {
            type: "notification",
            message: "Dispatch history"
          }
        ]
      });
    const sceneId = createResponse.body.data.sceneId as string;

    await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(ownerSession))
      .send({});

    const worker = createSceneActionDispatchWorker({
      workerId: "dispatch-history-worker",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined,
      dispatch: async () => {
        throw new Error("dispatcher offline");
      }
    });

    await worker.runOnce("2026-07-03T14:00:00.000Z");

    const dispatchResponse = await request(createApp())
      .get(`/api/v1/scenes/${sceneId}/dispatches`)
      .set(createAuthHeaders(ownerSession));

    expect(dispatchResponse.status).toBe(200);
    expect(dispatchResponse.body.data).toHaveLength(1);
    expect(dispatchResponse.body.data[0].status).toBe("failed");
    expect(dispatchResponse.body.data[0].lastError).toContain("dispatcher offline");
  });

  it("replays a failed scene dispatch job as a new queued delivery", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Replay Scene Owner",
      email: "replay-scene-owner@example.com"
    });
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Replay Scene Dispatch",
        status: "active",
        triggers: [{ type: "manual" }],
        conditions: [],
        actions: [
          {
            type: "notification",
            message: "Replay me"
          }
        ]
      });
    const sceneId = createResponse.body.data.sceneId as string;

    await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(ownerSession))
      .send({});

    const worker = createSceneActionDispatchWorker({
      workerId: "dispatch-replay-worker",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined,
      dispatch: async () => {
        throw new Error("temporary broker failure");
      }
    });

    await worker.runOnce("2026-07-03T14:05:00.000Z");
    const [failedJob] = await sceneTesting.listActionDispatches(sceneId);
    expect(failedJob?.status).toBe("failed");

    const replayResponse = await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/dispatches/${encodeURIComponent(failedJob!.jobId)}/replay`)
      .set(createAuthHeaders(ownerSession));

    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body.data.status).toBe("queued");
    expect(replayResponse.body.data.replayedFromJobId).toBe(failedJob?.jobId);

    const dispatches = await sceneTesting.listActionDispatches(sceneId);
    expect(dispatches).toHaveLength(2);
    expect(dispatches[1]?.status).toBe("queued");
    expect(dispatches[1]?.replayedFromJobId).toBe(failedJob?.jobId);
  });
});
