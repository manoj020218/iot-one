import { beforeEach, describe, expect, it } from "vitest";

import { createScene, sceneTesting } from "./scene.service";
import { createSceneRuntimeScheduler } from "./scene.scheduler";
import { createSceneRuntimeEvaluationWorker } from "./scene.runtime-worker";

const ownerContext = {
  userId: "user-scene-owner",
  homeId: "home-user-scene-owner",
  homeRole: "owner" as const
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve
  };
}

describe("scene runtime scheduler", () => {
  beforeEach(async () => {
    await sceneTesting.reset();
  });

  it("queues scheduled scene evaluations for active homes and lets the worker dedupe the same window", async () => {
    const scene = await createScene(
      {
        name: "Morning Tank Sync",
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
      },
      ownerContext
    );

    const scheduler = createSceneRuntimeScheduler({
      intervalMs: 30_000,
      now: () => new Date("2026-07-02T03:45:00.000Z"),
      logger: () => undefined
    });
    const worker = createSceneRuntimeEvaluationWorker({
      workerId: "scene-runtime-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const firstRun = await scheduler.runOnce();
    expect(firstRun.evaluatedHomeCount).toBe(1);
    expect(firstRun.enqueuedJobCount).toBe(1);
    expect(await sceneTesting.listRunHistory(scene.sceneId)).toHaveLength(0);

    const firstWorkerRun = await worker.runOnce("2026-07-02T03:45:05.000Z");
    expect(firstWorkerRun.runCount).toBe(1);
    expect(await sceneTesting.listRunHistory(scene.sceneId)).toHaveLength(1);

    const secondRun = await scheduler.runOnce();
    expect(secondRun.evaluatedHomeCount).toBe(1);
    expect(secondRun.enqueuedJobCount).toBe(1);

    const secondWorkerRun = await worker.runOnce("2026-07-02T03:45:10.000Z");
    expect(secondWorkerRun.runCount).toBe(0);
    expect(await sceneTesting.listRunHistory(scene.sceneId)).toHaveLength(1);
  });

  it("skips overlapping ticks in the same process", async () => {
    const gate = createDeferred<void>();
    const release = createDeferred<void>();
    const scheduler = createSceneRuntimeScheduler({
      intervalMs: 30_000,
      logger: () => undefined,
      getHomeIds: async () => {
        gate.resolve();
        await release.promise;
        return [];
      }
    });

    const firstRun = scheduler.runOnce("2026-07-02T03:45:00.000Z");

    await gate.promise;

    const secondRun = await scheduler.runOnce("2026-07-02T03:45:00.000Z");

    expect(secondRun.skippedReason).toBe("local_overlap");
    expect(secondRun.enqueuedJobCount).toBe(0);

    release.resolve();

    await firstRun;
  });
});
