import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { sceneTesting } from "./scene.service";

const ownerHeaders = {
  "x-user-id": "user-scene-owner",
  "x-home-id": "home-user-scene-owner",
  "x-home-role": "owner"
};

describe("scene routes", () => {
  beforeEach(() => {
    sceneTesting.reset();
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
        "x-user-id": "user-scene-owner",
        "x-home-id": "home-user-scene-owner",
        "x-home-role": "member"
      })
      .send({});

    expect(runResponse.status).toBe(403);
    expect(runResponse.body.error).toContain("Restricted scene command");
  });
});
