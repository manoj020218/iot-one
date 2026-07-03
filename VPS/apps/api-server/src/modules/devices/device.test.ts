import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { deviceTesting } from "./device.service";
import { homeTesting } from "../homes/home.service";
import { otaTesting } from "../ota/ota.service";
import { pidTesting } from "../pid/pid.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "device-tests"
};

const ownerIdentityHeaders = {
  "x-user-id": "user-1",
  "x-user-name": "Device Owner",
  "x-user-email": "device-owner@example.com"
};

const deviceHeaders = {
  "x-user-id": "user-1",
  "x-home-id": "home-user-1"
};

async function shareHomeAccess(
  role: "member" | "viewer",
  userId: string,
  name: string
) {
  const shareCodeResponse = await request(createApp())
    .post("/api/v1/homes/home-user-1/share-codes")
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
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await otaTesting.reset();
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
    await shareHomeAccess("member", "user-2", "Shared Member");

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
    await createOtaRelease({
      releaseId: "TANK-HW10-STABLE-110",
      version: "1.1.0"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f6",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1",
      firmwareVersion: "0.9.0"
    });
    await shareHomeAccess("member", "user-2", "Writable Member");

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
    expect(response.body.data.targetVersion).toBe("1.1.0");
  });

  it("rejects firmware requests from a viewer role", async () => {
    await createPid();
    await createOtaRelease();
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a7f7",
      pid: "JNX-TG-C3-501",
      homeId: "home-user-1",
      ownerUserId: "user-1",
      firmwareVersion: "0.9.0"
    });
    await shareHomeAccess("viewer", "user-3", "View Only User");

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

  it("resolves the correct OTA release by PID and hardware revision", async () => {
    await createPid();
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
      homeId: "home-user-1",
      ownerUserId: "user-1",
      firmwareVersion: "1.0.0",
      hardwareRevision: "HW1.0"
    });

    const response = await request(createApp())
      .get("/api/v1/devices/JNX-TG-A7F8/firmware-plan")
      .set(deviceHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data.stable.release.version).toBe("1.2.0");
    expect(response.body.data.stable.release.pid).toBe("JNX-TG-C3-501");
    expect(response.body.data.stable.release.hardwareRevision).toBe("HW1.0");
    expect(response.body.data.recommendedChannel).toBe("stable");
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
