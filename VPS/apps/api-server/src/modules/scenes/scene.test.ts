import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { homeTesting } from "../homes/home.service";
import { sceneTesting } from "./scene.service";

const ownerHeaders = {
  "x-user-id": "user-scene-owner",
  "x-home-id": "home-user-scene-owner",
  "x-home-role": "owner"
};

const ownerIdentityHeaders = {
  "x-user-id": "user-scene-owner",
  "x-user-name": "Scene Owner",
  "x-user-email": "scene-owner@example.com"
};

async function shareHomeAccess(
  role: "member" | "viewer",
  userId: string,
  name: string
) {
  const shareCodeResponse = await request(createApp())
    .post("/api/v1/homes/home-user-scene-owner/share-codes")
    .set(ownerIdentityHeaders)
    .send({ role });

  expect(shareCodeResponse.status).toBe(201);

  const redeemResponse = await request(createApp())
    .post("/api/v1/homes/redeem")
    .set({
      "x-user-id": userId,
      "x-user-name": name,
      "x-user-email": `${userId}@example.com`
    })
    .send({
      code: shareCodeResponse.body.data.code
    });

  expect(redeemResponse.status).toBe(200);
}

describe("scene routes", () => {
  beforeEach(async () => {
    await homeTesting.reset();
    await sceneTesting.reset();
  });

  it("creates and lists scenes for the current HOME", async () => {
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set(ownerHeaders);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
  });

  it("runs a scene manually when telemetry conditions match", async () => {
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set(ownerHeaders)
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
    await shareHomeAccess("member", "user-scene-member", "Scene Member");

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set({
        "x-user-id": "user-scene-member",
        "x-home-id": "home-user-scene-owner",
        "x-home-role": "member"
      })
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Restricted scene command");
  });

  it("blocks restricted Matter scene commands for non-owner roles", async () => {
    await shareHomeAccess("member", "user-scene-member", "Scene Member");

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set({
        "x-user-id": "user-scene-member",
        "x-home-id": "home-user-scene-owner",
        "x-home-role": "member"
      })
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Restricted scene command");
  });

  it("blocks viewer access from manually running a scene", async () => {
    await shareHomeAccess("viewer", "user-scene-viewer", "Scene Viewer");

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set({
        "x-user-id": "user-scene-viewer",
        "x-home-id": "home-user-scene-owner",
        "x-home-role": "viewer"
      })
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Viewer access");
  });

  it("evaluates active device-threshold scenes from telemetry runtime events", async () => {
    await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set(ownerHeaders)
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
    await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set(ownerHeaders)
      .send({
        occurredAt: "2026-07-02T03:45:00.000Z"
      });

    expect(firstRunResponse.status).toBe(200);
    expect(firstRunResponse.body.data.evaluatedSceneCount).toBe(1);
    expect(firstRunResponse.body.data.runs).toHaveLength(1);

    const secondRunResponse = await request(createApp())
      .post("/api/v1/scenes/runtime/schedule")
      .set(ownerHeaders)
      .send({
        occurredAt: "2026-07-02T03:45:00.000Z"
      });

    expect(secondRunResponse.status).toBe(200);
    expect(secondRunResponse.body.data.evaluatedSceneCount).toBe(0);
    expect(secondRunResponse.body.data.runs).toHaveLength(0);
  });

  it("returns run history for a scene after runtime execution", async () => {
    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(ownerHeaders)
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
      .set(ownerHeaders)
      .send({
        deviceId: "JNX-TG-C3-A7F2",
        telemetry: {
          tankLevelPct: 75
        }
      });

    const historyResponse = await request(createApp())
      .get(`/api/v1/scenes/${sceneId}/history`)
      .set(ownerHeaders);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data).toHaveLength(1);
    expect(historyResponse.body.data[0].source).toBe("device_threshold");
    expect(historyResponse.body.data[0].matchedConditions).toBe(true);
  });
});
