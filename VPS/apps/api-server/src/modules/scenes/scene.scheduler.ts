import {
  evaluateScheduledScenes,
  listActiveSceneHomeIds
} from "./scene.service";

export interface SceneRuntimeSchedulerOptions {
  intervalMs: number;
  now?: () => Date;
  logger?: (message: string) => void;
  getHomeIds?: () => Promise<string[]>;
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
  private readonly getHomeIds: () => Promise<string[]>;
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

  async runOnce(
    occurredAt = this.now().toISOString()
  ): Promise<SceneRuntimeSchedulerTickResult> {
    const homeIds = await this.getHomeIds();
    const result: SceneRuntimeSchedulerTickResult = {
      evaluatedHomeCount: 0,
      matchedRunCount: 0,
      runCount: 0
    };

    for (const homeId of homeIds) {
      const batch = await evaluateScheduledScenes(
        { occurredAt },
        {
          homeId
        }
      );

      result.evaluatedHomeCount += 1;
      result.matchedRunCount += batch.matchedRunCount;
      result.runCount += batch.runs.length;
    }

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

    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
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
