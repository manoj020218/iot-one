import {
  enqueueScheduledSceneEvaluation,
  listActiveSceneHomeIds
} from "./scene.service";
import type { SceneRuntimeQueueResponse } from "./scene.types";
import {
  createLocalSceneSchedulerCoordinator,
  type SceneSchedulerCoordinator
} from "./scene.scheduler.coordinator";

export interface SceneRuntimeSchedulerOptions {
  intervalMs: number;
  now?: () => Date;
  logger?: (message: string) => void;
  getHomeIds?: () => Promise<string[]>;
  dispatchHomeTick?: (
    homeId: string,
    occurredAt: string
  ) => Promise<SceneRuntimeQueueResponse>;
  coordinator?: SceneSchedulerCoordinator;
}

export interface SceneRuntimeSchedulerTickResult {
  evaluatedHomeCount: number;
  enqueuedJobCount: number;
  skippedReason?: "coordination_lock" | "local_overlap";
}

export class SceneRuntimeScheduler {
  private readonly intervalMs: number;
  private readonly now: () => Date;
  private readonly logger: ((message: string) => void) | undefined;
  private readonly getHomeIds: () => Promise<string[]>;
  private readonly dispatchHomeTick: (
    homeId: string,
    occurredAt: string
  ) => Promise<SceneRuntimeQueueResponse>;
  private readonly coordinator: SceneSchedulerCoordinator;
  private timer: NodeJS.Timeout | null = null;
  private tickInProgress = false;

  constructor(options: SceneRuntimeSchedulerOptions) {
    this.intervalMs = options.intervalMs;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
    this.getHomeIds = options.getHomeIds ?? listActiveSceneHomeIds;
    this.dispatchHomeTick =
      options.dispatchHomeTick ??
      ((homeId, occurredAt) =>
        enqueueScheduledSceneEvaluation(
          { occurredAt },
          {
            homeId
          }
        ));
    this.coordinator =
      options.coordinator ?? createLocalSceneSchedulerCoordinator();
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  private async evaluateTick(
    occurredAt: string
  ): Promise<SceneRuntimeSchedulerTickResult> {
    const homeIds = await this.getHomeIds();
    const result: SceneRuntimeSchedulerTickResult = {
      evaluatedHomeCount: 0,
      enqueuedJobCount: 0
    };

    for (const homeId of homeIds) {
      const batch = await this.dispatchHomeTick(homeId, occurredAt);

      result.evaluatedHomeCount += 1;
      result.enqueuedJobCount += batch.acceptedCount;
    }

    if (result.enqueuedJobCount > 0) {
      this.logger?.(
        `[scene-scheduler] evaluated ${result.evaluatedHomeCount} home(s) and queued ${result.enqueuedJobCount} runtime job(s)`
      );
    }

    return result;
  }

  async runOnce(
    occurredAt = this.now().toISOString()
  ): Promise<SceneRuntimeSchedulerTickResult> {
    if (this.tickInProgress) {
      this.logger?.("[scene-scheduler] skipped tick because the previous tick is still running");
      return {
        evaluatedHomeCount: 0,
        enqueuedJobCount: 0,
        skippedReason: "local_overlap"
      };
    }

    this.tickInProgress = true;

    try {
      const coordinated = await this.coordinator.runIfLeader(() =>
        this.evaluateTick(occurredAt)
      );

      if (!coordinated.executed) {
        this.logger?.(
          "[scene-scheduler] skipped tick because another scheduler instance holds the lease"
        );
        return {
          evaluatedHomeCount: 0,
          enqueuedJobCount: 0,
          skippedReason: "coordination_lock"
        };
      }

      return coordinated.value ?? {
        evaluatedHomeCount: 0,
        enqueuedJobCount: 0
      };
    } finally {
      this.tickInProgress = false;
    }
  }

  private triggerTick() {
    void this.runOnce().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.(`[scene-scheduler] tick failed: ${message}`);
    });
  }

  start() {
    if (this.timer) {
      return;
    }

    this.triggerTick();
    this.timer = setInterval(() => {
      this.triggerTick();
    }, this.intervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}

export function createSceneRuntimeScheduler(
  options: SceneRuntimeSchedulerOptions
): SceneRuntimeScheduler {
  return new SceneRuntimeScheduler(options);
}
