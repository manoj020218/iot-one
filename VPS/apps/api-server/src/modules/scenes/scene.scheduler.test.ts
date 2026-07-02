import { beforeEach, describe, expect, it } from "vitest";

import { createScene } from "./scene.service";
import { createSceneRuntimeScheduler } from "./scene.scheduler";
import { sceneTesting } from "./scene.service";

const ownerContext = {
  userId: "user-scene-owner",
  homeId: "home-user-scene-owner",
  homeRole: "owner" as const
};

describe("scene runtime scheduler", () => {
  beforeEach(() => {
    sceneTesting.reset();
  });

  it("evaluates scheduled scenes for active homes and dedupes the same window", () => {
    const scene = createScene(
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

    const firstRun = scheduler.runOnce();
    expect(firstRun.evaluatedHomeCount).toBe(1);
    expect(firstRun.runCount).toBe(1);
    expect(firstRun.matchedRunCount).toBe(1);
    expect(sceneTesting.listRunHistory(scene.sceneId)).toHaveLength(1);

    const secondRun = scheduler.runOnce();
    expect(secondRun.evaluatedHomeCount).toBe(1);
    expect(secondRun.runCount).toBe(0);
    expect(sceneTesting.listRunHistory(scene.sceneId)).toHaveLength(1);
  });
});
