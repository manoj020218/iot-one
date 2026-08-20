import { randomUUID } from "node:crypto";

import type { SceneRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetCameraStore } from "../cameras/camera.model";
import { createCamera } from "../cameras/camera.service";
import { resetDestinationStore } from "../destinations/destination.model";
import { createDestination } from "../destinations/destination.service";
import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { resetScheduleStore } from "./schedule.model";
import {
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  runScheduleNow,
  updateSchedule
} from "./schedule.service";
import { StreamerScheduleError } from "./schedule.types";

const HOME_ID = "HOME-1";

function makeFakeScene(name: string): SceneRecord {
  return {
    sceneId: `SCENE-${randomUUID().slice(0, 8)}`,
    homeId: HOME_ID,
    ownerUserId: "USER-1",
    name,
    status: "active",
    triggers: [{ triggerId: "T-1", type: "schedule" }],
    conditions: [],
    actions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeDeps(): SmartStreamerPlatformDeps {
  return {
    requireAuthenticatedUser: (_request, _response, next) => next(),
    requireAuthenticatedRequestUser: () => ({ userId: "USER-1" }),
    readHomeIdFromRequest: () => HOME_ID,
    listDevices: async () => [],
    getDevice: async () => {
      throw new Error("not used in this test");
    },
    dispatchDeviceUiCommand: async () => {
      throw new Error("not used in this test");
    },
    createScene: vi.fn(async (payload) => makeFakeScene(payload.name)),
    patchScene: vi.fn(async () => makeFakeScene("patched")),
    deleteScene: vi.fn(async (sceneId) => ({ sceneId })),
    listScenes: async () => [],
    runSceneManually: vi.fn(async (sceneId) => ({ sceneId }))
  };
}

async function seedCameraAndDestination() {
  const camera = await createCamera(HOME_ID, {
    friendlyName: "Front Gate",
    rtspHost: "192.168.1.40",
    rtspPort: 554,
    rtspPath: "/stream1"
  });
  const destination = await createDestination(HOME_ID, {
    platform: "youtube",
    displayName: "Main Channel",
    serverUrl: "rtmps://a.rtmps.youtube.com/live2",
    streamKey: "secret-key"
  });
  return { camera, destination };
}

beforeEach(async () => {
  await resetCameraStore();
  await resetDestinationStore();
  await resetScheduleStore();
});

describe("createSchedule", () => {
  it("creates a paired start/stop Scene via deps.createScene", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();

    const schedule = await createSchedule(
      deps,
      HOME_ID,
      {
        name: "Evening Aarti",
        deviceId: "JNX-P4-000101",
        cameraId: camera.cameraId,
        destinationId: destination.destinationId,
        startLocalTime: "18:00",
        stopLocalTime: "19:00",
        daysOfWeek: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      },
      {}
    );

    expect(deps.createScene).toHaveBeenCalledTimes(2);
    expect(schedule.timezone).toBe("Asia/Kolkata");
    expect((schedule as unknown as { startSceneId?: string }).startSceneId).toBeUndefined();
  });

  it("rejects an overlapping schedule for the same device with SCHEDULE_CONFLICT", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const base = {
      deviceId: "JNX-P4-000101",
      cameraId: camera.cameraId,
      destinationId: destination.destinationId,
      daysOfWeek: ["mon"] as const
    };

    await createSchedule(
      deps,
      HOME_ID,
      { ...base, name: "First", startLocalTime: "18:00", stopLocalTime: "19:00", daysOfWeek: [...base.daysOfWeek] },
      {}
    );

    await expect(
      createSchedule(
        deps,
        HOME_ID,
        {
          ...base,
          name: "Overlapping",
          startLocalTime: "18:30",
          stopLocalTime: "19:30",
          daysOfWeek: [...base.daysOfWeek]
        },
        {}
      )
    ).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT" });
  });

  it("allows a non-overlapping schedule on the same device and day", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const base = {
      deviceId: "JNX-P4-000101",
      cameraId: camera.cameraId,
      destinationId: destination.destinationId
    };

    await createSchedule(
      deps,
      HOME_ID,
      { ...base, name: "Morning", startLocalTime: "06:00", stopLocalTime: "07:00", daysOfWeek: ["mon"] },
      {}
    );

    await expect(
      createSchedule(
        deps,
        HOME_ID,
        { ...base, name: "Evening", startLocalTime: "18:00", stopLocalTime: "19:00", daysOfWeek: ["mon"] },
        {}
      )
    ).resolves.toMatchObject({ name: "Evening" });
  });
});

describe("updateSchedule / deleteSchedule / duplicateSchedule / runScheduleNow", () => {
  it("patches both Scenes on update", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const schedule = await createSchedule(
      deps,
      HOME_ID,
      {
        name: "Evening Aarti",
        deviceId: "JNX-P4-000101",
        cameraId: camera.cameraId,
        destinationId: destination.destinationId,
        startLocalTime: "18:00",
        stopLocalTime: "19:00",
        daysOfWeek: ["mon"]
      },
      {}
    );

    await updateSchedule(deps, schedule.scheduleId, HOME_ID, { startLocalTime: "18:15" }, {});

    expect(deps.patchScene).toHaveBeenCalledTimes(2);
  });

  it("deletes both Scenes on delete", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const schedule = await createSchedule(
      deps,
      HOME_ID,
      {
        name: "Evening Aarti",
        deviceId: "JNX-P4-000101",
        cameraId: camera.cameraId,
        destinationId: destination.destinationId,
        startLocalTime: "18:00",
        stopLocalTime: "19:00",
        daysOfWeek: ["mon"]
      },
      {}
    );

    await deleteSchedule(deps, schedule.scheduleId, HOME_ID, {});

    expect(deps.deleteScene).toHaveBeenCalledTimes(2);
  });

  it("duplicates a schedule as disabled", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const schedule = await createSchedule(
      deps,
      HOME_ID,
      {
        name: "Evening Aarti",
        deviceId: "JNX-P4-000101",
        cameraId: camera.cameraId,
        destinationId: destination.destinationId,
        startLocalTime: "18:00",
        stopLocalTime: "19:00",
        daysOfWeek: ["mon"]
      },
      {}
    );

    const copy = await duplicateSchedule(deps, schedule.scheduleId, HOME_ID, {});

    expect(copy.name).toBe("Evening Aarti (copy)");
    expect(copy.enabled).toBe(false);
  });

  it("calls runSceneManually on the start Scene for run-now", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const schedule = await createSchedule(
      deps,
      HOME_ID,
      {
        name: "Evening Aarti",
        deviceId: "JNX-P4-000101",
        cameraId: camera.cameraId,
        destinationId: destination.destinationId,
        startLocalTime: "18:00",
        stopLocalTime: "19:00",
        daysOfWeek: ["mon"]
      },
      {}
    );

    await runScheduleNow(deps, schedule.scheduleId, HOME_ID, {});

    expect(deps.runSceneManually).toHaveBeenCalledTimes(1);
  });

  it("throws for a schedule that doesn't exist", async () => {
    const deps = makeDeps();
    await expect(updateSchedule(deps, "SCH-MISSING", HOME_ID, {}, {})).rejects.toBeInstanceOf(
      StreamerScheduleError
    );
  });
});
