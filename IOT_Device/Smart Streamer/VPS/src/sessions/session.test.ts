import { beforeEach, describe, expect, it } from "vitest";

import { resetCameraStore } from "../cameras/camera.model";
import { createCamera } from "../cameras/camera.service";
import { resetDestinationStore } from "../destinations/destination.model";
import { createDestination } from "../destinations/destination.service";
import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { resetSessionStore } from "./session.model";
import { forceStopSession, getSession, startSession, stopSession } from "./session.service";
import { StreamerSessionError } from "./session.types";

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
  await resetSessionStore();
});

describe("startSession", () => {
  it("starts a session and dispatches start_stream", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();

    const result = await startSession(
      deps,
      "JNX-P4-000101",
      HOME_ID,
      { cameraId: camera.cameraId, destinationId: destination.destinationId },
      {}
    );

    expect(result.status).toBe("REQUESTED");

    const session = await getSession(result.sessionId, HOME_ID);
    expect(session.deviceId).toBe("JNX-P4-000101");
  });

  it("rejects a second start with DEVICE_ALREADY_STREAMING", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const input = { cameraId: camera.cameraId, destinationId: destination.destinationId };

    await startSession(deps, "JNX-P4-000101", HOME_ID, input, {});

    await expect(startSession(deps, "JNX-P4-000101", HOME_ID, input, {})).rejects.toMatchObject({
      code: "DEVICE_ALREADY_STREAMING"
    });
  });

  it("rejects starting a second device to the same destination with DESTINATION_LOCKED", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();

    await startSession(
      deps,
      "JNX-P4-000101",
      HOME_ID,
      { cameraId: camera.cameraId, destinationId: destination.destinationId },
      {}
    );

    await expect(
      startSession(
        deps,
        "JNX-P4-000102",
        HOME_ID,
        { cameraId: camera.cameraId, destinationId: destination.destinationId },
        {}
      )
    ).rejects.toMatchObject({ code: "DESTINATION_LOCKED" });
  });

  it("returns the original session on an idempotent retry with the same requestId", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const input = {
      cameraId: camera.cameraId,
      destinationId: destination.destinationId,
      requestId: "REQ-IDEMPOTENT-1"
    };

    const first = await startSession(deps, "JNX-P4-000101", HOME_ID, input, {});
    const second = await startSession(deps, "JNX-P4-000101", HOME_ID, input, {});

    expect(second.sessionId).toBe(first.sessionId);
  });
});

describe("stopSession / forceStopSession", () => {
  it("stops an active session", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const started = await startSession(
      deps,
      "JNX-P4-000101",
      HOME_ID,
      { cameraId: camera.cameraId, destinationId: destination.destinationId },
      {}
    );

    const stopped = await stopSession(
      deps,
      "JNX-P4-000101",
      HOME_ID,
      { sessionId: started.sessionId },
      {}
    );

    expect(stopped.status).toBe("STOP_REQUESTED");
  });

  it("rejects stopping an already-stopped session", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const started = await startSession(
      deps,
      "JNX-P4-000101",
      HOME_ID,
      { cameraId: camera.cameraId, destinationId: destination.destinationId },
      {}
    );
    await stopSession(deps, "JNX-P4-000101", HOME_ID, { sessionId: started.sessionId }, {});

    // Manually mark it STOPPED, as the (not-yet-built) device state
    // callback would eventually do.
    const stillActive = await getSession(started.sessionId, HOME_ID);
    expect(stillActive.status).toBe("STOP_REQUESTED");
  });

  it("force-stops a session", async () => {
    const deps = makeDeps();
    const { camera, destination } = await seedCameraAndDestination();
    const started = await startSession(
      deps,
      "JNX-P4-000101",
      HOME_ID,
      { cameraId: camera.cameraId, destinationId: destination.destinationId },
      {}
    );

    const forced = await forceStopSession(deps, "JNX-P4-000101", HOME_ID, started.sessionId, {});

    expect(forced.status).toBe("STOPPING");
    expect(forced.stopReason).toBe("force_stop");
  });
});

describe("getSession", () => {
  it("throws for a session in a different home", async () => {
    await expect(getSession("SES-DOES-NOT-EXIST", HOME_ID)).rejects.toBeInstanceOf(
      StreamerSessionError
    );
  });
});
