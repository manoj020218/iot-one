import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { deviceTesting, getDevice } from "../../modules/devices/device.service";
import { pidTesting } from "../../modules/pid/pid.service";
import { sceneEvaluationJobRepository } from "../../modules/scenes/scene.model";
import { sceneTesting } from "../../modules/scenes/scene.service";
import { createAuthenticatedSession } from "../../test-support/auth";
import { authTesting } from "../../modules/auth/auth.service";
import { homeTesting } from "../../modules/homes/home.service";

import { handleRuntimeLegacyDeviceMessage } from "./runtime.handlers";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "tank-guard-legacy-tests"
};

async function createPid() {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid: "JNX-TG-C3-001",
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.3"
      }
    });
}

describe("Tank Guard legacy MQTT family (jnx/tg)", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
    await sceneTesting.reset();
  });

  it("applies real firmware telemetry and enqueues a scene evaluation job", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Tank Guard Owner",
      email: "tank-guard-owner@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-a001",
      pid: "JNX-TG-C3-001",
      homeId,
      ownerUserId: owner.user.userId
    });

    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jnx/tg",
      deviceId: "JNX-TG-A001",
      suffix: "telemetry",
      payload: {
        project: "Smart Tank Guard by Jenix",
        pid: "JNX-TG-C3-001",
        water_level_mm: 520,
        tankLevelPct: 62,
        alarm_active: false,
        current_state: "IDLE",
        motor_status: "Assumed OFF"
      }
    });

    const device = await getDevice("JNX-TG-A001", {
      userId: owner.user.userId,
      homeId
    });
    expect(device.lastSeenAt).toBeTruthy();

    const jobs = await sceneEvaluationJobRepository.listByHome(homeId);
    const tankGuardJob = jobs.find((job) => job.deviceId === "JNX-TG-A001");
    expect(tankGuardJob).toBeDefined();
    expect(tankGuardJob?.telemetry?.water_level_mm).toBe(520);
    expect(tankGuardJob?.telemetry?.tankLevelPct).toBe(62);
    expect(tankGuardJob?.source).toBe("device_threshold");
  });

  it("treats the status suffix the same as telemetry", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Tank Guard Owner 2",
      email: "tank-guard-owner-2@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-b002",
      pid: "JNX-TG-C3-001",
      homeId,
      ownerUserId: owner.user.userId
    });

    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jnx/tg",
      deviceId: "JNX-TG-B002",
      suffix: "status",
      payload: { state: "FILLING", alarm_active: true }
    });

    const jobs = await sceneEvaluationJobRepository.listByHome(homeId);
    expect(jobs.some((job) => job.deviceId === "JNX-TG-B002")).toBe(true);
  });

  it("silently ignores telemetry for an unregistered device", async () => {
    await expect(
      handleRuntimeLegacyDeviceMessage({
        topicRoot: "jnx/tg",
        deviceId: "JNX-TG-UNKNOWN",
        suffix: "telemetry",
        payload: { water_level_mm: 100 }
      })
    ).resolves.toBeUndefined();
  });

  it("does not act on event/alarm/config suffixes yet", async () => {
    await createPid();
    const owner = await createAuthenticatedSession({
      name: "Tank Guard Owner 3",
      email: "tank-guard-owner-3@example.com"
    });
    const homeId = owner.activeHomeId!;
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-c003",
      pid: "JNX-TG-C3-001",
      homeId,
      ownerUserId: owner.user.userId
    });

    await handleRuntimeLegacyDeviceMessage({
      topicRoot: "jnx/tg",
      deviceId: "JNX-TG-C003",
      suffix: "alarm",
      payload: { alarm_code: "OVERFLOW" }
    });

    const jobs = await sceneEvaluationJobRepository.listByHome(homeId);
    expect(jobs.some((job) => job.deviceId === "JNX-TG-C003")).toBe(false);
  });

  it("ignores messages for topic roots it doesn't own", async () => {
    await expect(
      handleRuntimeLegacyDeviceMessage({
        topicRoot: "some/other/root",
        deviceId: "JNX-XX-0001",
        suffix: "telemetry",
        payload: { value: 1 }
      })
    ).resolves.toBeUndefined();
  });
});
