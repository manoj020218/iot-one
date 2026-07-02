import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { deviceTesting } from "./device.service";
import { pidTesting } from "../pid/pid.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "device-tests"
};

const deviceHeaders = {
  "x-user-id": "user-1",
  "x-home-id": "home-user-1"
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

describe("device routes", () => {
  beforeEach(() => {
    deviceTesting.reset();
    pidTesting.reset();
  });

  it("registers a device against an existing PID", async () => {
    await createPid();

    const response = await request(createApp())
      .post("/api/v1/devices/register")
      .send({
        deviceId: "jnx-tg-a7f2",
        pid: "JNX-TG-C3-501",
        homeId: "home-user-1",
        ownerUserId: "user-1",
        firmwareVersion: "1.0.0"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.pid).toBe("JNX-TG-C3-501");
    expect(response.body.data.deviceId).toBe("JNX-TG-A7F2");
    expect(response.body.data.displayName).toBe("Smart Tank Guard");
  });

  it("renames a registered device for its owner", async () => {
    await createPid();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f3",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1"
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F3/rename")
      .set(deviceHeaders)
      .send({
        displayName: "Main Tank"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe("Main Tank");
  });

  it("allows a shared HOME member to rename a device inside the same HOME", async () => {
    await createPid();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f5",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1"
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F5/rename")
      .set({
        "x-user-id": "user-2",
        "x-home-id": "home-user-1",
        "x-home-role": "member"
      })
      .send({
        displayName: "Shared Tank"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe("Shared Tank");
  });

  it("queues a firmware request for a writable HOME role", async () => {
    await createPid();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f6",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1",
      firmwareVersion: "0.9.0"
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F6/firmware/request")
      .set({
        "x-user-id": "user-2",
        "x-home-id": "home-user-1",
        "x-home-role": "member"
      })
      .send({
        channel: "stable"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("queued");
    expect(response.body.data.targetVersion).toBe("1.0.0");
  });

  it("rejects firmware requests from a viewer role", async () => {
    await createPid();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f7",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1",
      firmwareVersion: "0.9.0"
    });

    const response = await request(createApp())
      .post("/api/v1/devices/JNX-TG-A7F7/firmware/request")
      .set({
        "x-user-id": "user-3",
        "x-home-id": "home-user-1",
        "x-home-role": "viewer"
      })
      .send({
        channel: "stable"
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/firmware/i);
  });

  it("ingests telemetry and triggers matching device-threshold scenes", async () => {
    await createPid();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f4",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1"
    });
    await request(createApp())
      .post("/api/v1/scenes")
      .set({
        "x-user-id": "user-1",
        "x-home-id": "home-user-1",
        "x-home-role": "owner"
      })
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
    expect(response.body.data.sceneRuntime.matchedRunCount).toBe(1);
    expect(response.body.data.sceneRuntime.runs[0].scene.lastRunStatus).toBe("success");
  });
});
