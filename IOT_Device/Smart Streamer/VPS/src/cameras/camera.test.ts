import { beforeEach, describe, expect, it } from "vitest";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { resetCameraStore } from "./camera.model";
import {
  assignCamera,
  createCamera,
  deleteCamera,
  getCameraTest,
  listCameras,
  startCameraTest
} from "./camera.service";
import { StreamerCameraError } from "./camera.types";

const HOME_ID = "HOME-1";

function makeDeps(): SmartStreamerPlatformDeps {
  return {
    requireAuthenticatedUser: (_request, _response, next) => next(),
    requireAuthenticatedRequestUser: () => ({ userId: "USER-1" }),
    readHomeIdFromRequest: () => HOME_ID,
    listDevices: async () => [],
    getDevice: async () => {
      throw new Error("not used in this test");
    },
    dispatchDeviceUiCommand: async (deviceId, payload) => ({
      commandId: "CMD-1",
      deviceId,
      status: "queued",
      queuedAt: new Date().toISOString(),
      ...(payload.payload ? { payload: payload.payload } : {})
    }),
    createScene: async () => {
      throw new Error("not used in this test");
    },
    patchScene: async () => {
      throw new Error("not used in this test");
    },
    deleteScene: async () => {
      throw new Error("not used in this test");
    },
    listScenes: async () => {
      throw new Error("not used in this test");
    },
    runSceneManually: async () => {
      throw new Error("not used in this test");
    }
  };
}

beforeEach(async () => {
  await resetCameraStore();
});

describe("createCamera / listCameras", () => {
  it("creates a camera and never exposes the password", async () => {
    const created = await createCamera(HOME_ID, {
      friendlyName: "Front Gate",
      rtspHost: "192.168.1.40",
      rtspPort: 554,
      rtspPath: "/stream1",
      rtspUsername: "admin",
      rtspPassword: "secret123"
    });

    expect((created as unknown as { rtspPassword?: string }).rtspPassword).toBeUndefined();
    expect(created.hasCredentials).toBe(true);

    const list = await listCameras(HOME_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.cameraId).toBe(created.cameraId);
  });

  it("scopes cameras by home", async () => {
    await createCamera(HOME_ID, {
      friendlyName: "Front Gate",
      rtspHost: "192.168.1.40",
      rtspPort: 554,
      rtspPath: "/stream1"
    });

    const otherHome = await listCameras("HOME-2");
    expect(otherHome).toHaveLength(0);
  });
});

describe("deleteCamera", () => {
  it("rejects deleting a camera assigned to a device", async () => {
    const camera = await createCamera(HOME_ID, {
      friendlyName: "Front Gate",
      rtspHost: "192.168.1.40",
      rtspPort: 554,
      rtspPath: "/stream1"
    });
    await assignCamera(camera.cameraId, HOME_ID, "JNX-P4-000101");

    await expect(deleteCamera(camera.cameraId, HOME_ID)).rejects.toBeInstanceOf(
      StreamerCameraError
    );
  });

  it("allows deleting an unassigned camera", async () => {
    const camera = await createCamera(HOME_ID, {
      friendlyName: "Front Gate",
      rtspHost: "192.168.1.40",
      rtspPort: 554,
      rtspPath: "/stream1"
    });

    await expect(deleteCamera(camera.cameraId, HOME_ID)).resolves.toBeUndefined();
  });
});

describe("camera test flow", () => {
  it("starts a test session with all steps pending and dispatches the command", async () => {
    const deps = makeDeps();
    const camera = await createCamera(HOME_ID, {
      friendlyName: "Front Gate",
      rtspHost: "192.168.1.40",
      rtspPort: 554,
      rtspPath: "/stream1"
    });

    const session = await startCameraTest(deps, camera.cameraId, HOME_ID, "JNX-P4-000101", {
      userId: "USER-1",
      homeId: HOME_ID
    });

    expect(session.status).toBe("in_progress");
    expect(session.steps).toHaveLength(6);
    expect(session.steps.every((step) => step.status === "pending")).toBe(true);

    const fetched = await getCameraTest(session.testId);
    expect(fetched.testId).toBe(session.testId);
  });
});
