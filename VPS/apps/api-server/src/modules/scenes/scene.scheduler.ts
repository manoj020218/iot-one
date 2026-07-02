import {
  evaluateScheduledScenes,
  listActiveSceneHomeIds
} from "./scene.service";

export interface SceneRuntimeSchedulerOptions {
  intervalMs: number;
  now?: () => Date;
  logger?: (message: string) => void;
  getHomeIds?: () => string[];
}

export interface SceneRuntimeSchedulerTickResult {
  evaluatedHomeCount: number;
  matchedRunCount: number;
  runCount: number;
}

export class SceneRuntimeScheduler {
  private readonly intervalMs: number;
  private readonly now: () => Date;
  private readonly logger: ((message: string) => void) | undefined;
  private readonly getHomeIds: () => string[];
  private timer: NodeJS.Timeout | null = null;

  constructor(options: SceneRuntimeSchedulerOptions) {
    this.intervalMs = options.intervalMs;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
    this.getHomeIds = options.getHomeIds ?? listActiveSceneHomeIds;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  runOnce(occurredAt = this.now().toISOString()): SceneRuntimeSchedulerTickResult {
    const homeIds = this.getHomeIds();
    const result = homeIds.reduce<SceneRuntimeSchedulerTickResult>(
      (summary, homeId) => {
        const batch = evaluateScheduledScenes(
          { occurredAt },
          {
            homeId
          }
        );

        return {
          evaluatedHomeCount: summary.evaluatedHomeCount + 1,
          matchedRunCount: summary.matchedRunCount + batch.matchedRunCount,
          runCount: summary.runCount + batch.runs.length
        };
      },
      {
        evaluatedHomeCount: 0,
        matchedRunCount: 0,
        runCount: 0
      }
    );

    if (result.runCount > 0) {
      this.logger?.(
        `[scene-scheduler] evaluated ${result.evaluatedHomeCount} home(s), executed ${result.runCount} run(s), matched ${result.matchedRunCount} scene(s)`
      );
    }

    return result;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.runOnce();
    this.timer = setInterval(() => {
      this.runOnce();
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
