import { beforeEach, describe, expect, it } from "vitest";

import {
  createScene,
  enqueueScheduledSceneEvaluation,
  enqueueSceneEvaluationByTelemetry,
  sceneTesting
} from "./scene.service";
import { createSceneRuntimeEvaluationWorker } from "./scene.runtime-worker";

const ownerContext = {
  userId: "user-scene-owner",
  homeId: "home-user-scene-owner",
  homeRole: "owner" as const
};

describe("scene runtime evaluation worker", () => {
  beforeEach(async () => {
    await sceneTesting.reset();
  });

  it("processes queued telemetry runtime jobs and records run history", async () => {
    const scene = await createScene(
      {
        name: "Queued Tank Alert",
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
            message: "Queued tank alert"
          }
        ]
      },
      ownerContext
    );

    const queueResponse = await enqueueSceneEvaluationByTelemetry(
      {
        deviceId: "JNX-TG-C3-A7F2",
        telemetry: {
          tankLevelPct: 83
        },
        occurredAt: "2026-07-03T07:00:00.000Z"
      },
      {
        homeId: ownerContext.homeId
      }
    );

    expect(queueResponse.acceptedCount).toBe(1);
    expect(await sceneTesting.listRunHistory(scene.sceneId)).toHaveLength(0);

    const worker = createSceneRuntimeEvaluationWorker({
      workerId: "scene-runtime-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const result = await worker.runOnce("2026-07-03T07:00:05.000Z");
    expect(result.claimedCount).toBe(1);
    expect(result.completedCount).toBe(1);
    expect(result.evaluatedSceneCount).toBe(1);
    expect(result.matchedRunCount).toBe(1);
    expect(result.runCount).toBe(1);

    const history = await sceneTesting.listRunHistory(scene.sceneId);
    expect(history).toHaveLength(1);
    expect(history[0]?.source).toBe("device_threshold");
    expect((await sceneTesting.listActionDispatches(scene.sceneId))[0]?.status).toBe("queued");
  });

  it("processes queued schedule runtime jobs through the worker", async () => {
    const scene = await createScene(
      {
        name: "Queued Morning Sync",
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
          daysOfWeek: [5],
          time: "09:15"
        }
      },
      ownerContext
    );

    const queueResponse = await enqueueScheduledSceneEvaluation(
      {
        occurredAt: "2026-07-03T03:45:00.000Z"
      },
      {
        homeId: ownerContext.homeId
      }
    );

    expect(queueResponse.acceptedCount).toBe(1);

    const worker = createSceneRuntimeEvaluationWorker({
      workerId: "scene-runtime-worker-test",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    const result = await worker.runOnce("2026-07-03T03:45:05.000Z");
    expect(result.claimedCount).toBe(1);
    expect(result.completedCount).toBe(1);
    expect(result.runCount).toBe(1);

    const history = await sceneTesting.listRunHistory(scene.sceneId);
    expect(history).toHaveLength(1);
    expect(history[0]?.source).toBe("schedule");
  });
});
