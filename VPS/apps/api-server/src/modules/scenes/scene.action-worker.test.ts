import { beforeEach, describe, expect, it } from "vitest";

import { createSceneActionDispatchWorker } from "./scene.action-worker";
import { createScene, runSceneManually, sceneTesting } from "./scene.service";

const ownerContext = {
  userId: "user-scene-owner",
  homeId: "home-user-scene-owner",
  homeRole: "owner" as const
};

describe("scene action dispatch worker", () => {
  beforeEach(async () => {
    await sceneTesting.reset();
  });

  it("claims queued scene actions and marks them completed", async () => {
    const scene = await createScene(
      {
        name: "Queued Device Sync",
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
            command: "sync"
          }
        ]
      },
      ownerContext
    );

    await runSceneManually(scene.sceneId, {}, ownerContext);

    const queuedJobs = await sceneTesting.listActionDispatches(scene.sceneId);
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0]?.status).toBe("queued");

    const worker = createSceneActionDispatchWorker({
      workerId: "scene-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const result = await worker.runOnce("2026-07-03T10:00:00.000Z");
    expect(result.claimedCount).toBe(1);
    expect(result.completedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const completedJobs = await sceneTesting.listActionDispatches(scene.sceneId);
    expect(completedJobs[0]?.status).toBe("completed");
    expect(completedJobs[0]?.completedAt).toBe("2026-07-03T10:00:00.000Z");
  });

  it("marks scene action jobs as failed when the dispatcher throws", async () => {
    const scene = await createScene(
      {
        name: "Failing Scene Action",
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
            message: "Queue me"
          }
        ]
      },
      ownerContext
    );

    await runSceneManually(scene.sceneId, {}, ownerContext);

    const worker = createSceneActionDispatchWorker({
      workerId: "scene-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined,
      dispatch: async () => {
        throw new Error("dispatcher offline");
      }
    });

    const result = await worker.runOnce("2026-07-03T10:05:00.000Z");
    expect(result.claimedCount).toBe(1);
    expect(result.completedCount).toBe(0);
    expect(result.failedCount).toBe(1);

    const failedJobs = await sceneTesting.listActionDispatches(scene.sceneId);
    expect(failedJobs[0]?.status).toBe("failed");
    expect(failedJobs[0]?.lastError).toMatch(/dispatcher offline/i);
  });
});
