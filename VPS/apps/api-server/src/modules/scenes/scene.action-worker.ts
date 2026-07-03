import {
  sceneActionDispatchRepository,
  type ClaimSceneActionDispatchJobsInput
} from "./scene.model";
import type { SceneActionDispatchJob } from "./scene.types";

export interface SceneActionDispatchWorkerOptions {
  workerId: string;
  intervalMs: number;
  batchSize: number;
  visibilityTimeoutMs: number;
  now?: () => Date;
  logger?: (message: string) => void;
  dispatch?: (job: SceneActionDispatchJob) => Promise<void>;
}

export interface SceneActionDispatchWorkerRunResult {
  claimedCount: number;
  completedCount: number;
  failedCount: number;
  skippedReason?: "local_overlap";
}

async function dispatchSceneAction(job: SceneActionDispatchJob): Promise<void> {
  void job;
}

export class SceneActionDispatchWorker {
  private readonly workerId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly visibilityTimeoutMs: number;
  private readonly now: () => Date;
  private readonly logger: ((message: string) => void) | undefined;
  private readonly dispatch: (job: SceneActionDispatchJob) => Promise<void>;
  private timer: NodeJS.Timeout | null = null;
  private runInProgress = false;

  constructor(options: SceneActionDispatchWorkerOptions) {
    this.workerId = options.workerId;
    this.intervalMs = options.intervalMs;
    this.batchSize = options.batchSize;
    this.visibilityTimeoutMs = options.visibilityTimeoutMs;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
    this.dispatch = options.dispatch ?? dispatchSceneAction;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  private createClaimInput(now: string): ClaimSceneActionDispatchJobsInput {
    return {
      workerId: this.workerId,
      limit: this.batchSize,
      now,
      visibilityTimeoutMs: this.visibilityTimeoutMs
    };
  }

  async runOnce(
    occurredAt = this.now().toISOString()
  ): Promise<SceneActionDispatchWorkerRunResult> {
    if (this.runInProgress) {
      this.logger?.(
        "[scene-action-worker] skipped tick because the previous run is still in progress"
      );
      return {
        claimedCount: 0,
        completedCount: 0,
        failedCount: 0,
        skippedReason: "local_overlap"
      };
    }

    this.runInProgress = true;

    try {
      const claimedJobs = await sceneActionDispatchRepository.claimNextBatch(
        this.createClaimInput(occurredAt)
      );
      const result: SceneActionDispatchWorkerRunResult = {
        claimedCount: claimedJobs.length,
        completedCount: 0,
        failedCount: 0
      };

      for (const job of claimedJobs) {
        try {
          await this.dispatch(job);
          await sceneActionDispatchRepository.complete(job.jobId, occurredAt);
          result.completedCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await sceneActionDispatchRepository.fail(job.jobId, occurredAt, message);
          result.failedCount += 1;
        }
      }

      if (result.claimedCount > 0) {
        this.logger?.(
          `[scene-action-worker] claimed ${result.claimedCount} job(s), completed ${result.completedCount}, failed ${result.failedCount}`
        );
      }

      return result;
    } finally {
      this.runInProgress = false;
    }
  }

  private triggerRun() {
    void this.runOnce().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.(`[scene-action-worker] run failed: ${message}`);
    });
  }

  start() {
    if (this.timer) {
      return;
    }

    this.triggerRun();
    this.timer = setInterval(() => {
      this.triggerRun();
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

export function createSceneActionDispatchWorker(
  options: SceneActionDispatchWorkerOptions
): SceneActionDispatchWorker {
  return new SceneActionDispatchWorker(options);
}
