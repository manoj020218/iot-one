import { sceneEvaluationJobRepository } from "./scene.model";
import {
  evaluateScheduledScenes,
  evaluateScenesByTelemetry
} from "./scene.service";
import type {
  SceneEvaluationJob,
  SceneRuntimeBatchResponse
} from "./scene.types";

export interface SceneRuntimeEvaluationWorkerOptions {
  workerId: string;
  intervalMs: number;
  batchSize: number;
  visibilityTimeoutMs: number;
  now?: () => Date;
  logger?: (message: string) => void;
  dispatch?: (job: SceneEvaluationJob) => Promise<SceneRuntimeBatchResponse>;
}

export interface SceneRuntimeEvaluationWorkerRunResult {
  claimedCount: number;
  completedCount: number;
  failedCount: number;
  evaluatedSceneCount: number;
  matchedRunCount: number;
  runCount: number;
  skippedReason?: "local_overlap";
}

async function dispatchSceneEvaluationJob(
  job: SceneEvaluationJob
): Promise<SceneRuntimeBatchResponse> {
  if (job.source === "device_threshold") {
    if (!job.deviceId || !job.telemetry) {
      throw new Error("Telemetry runtime job is missing device telemetry payload");
    }

    return evaluateScenesByTelemetry(
      {
        deviceId: job.deviceId,
        telemetry: job.telemetry,
        occurredAt: job.occurredAt
      },
      {
        homeId: job.homeId
      }
    );
  }

  return evaluateScheduledScenes(
    {
      occurredAt: job.occurredAt
    },
    {
      homeId: job.homeId
    }
  );
}

export class SceneRuntimeEvaluationWorker {
  private readonly workerId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly visibilityTimeoutMs: number;
  private readonly now: () => Date;
  private readonly logger: ((message: string) => void) | undefined;
  private readonly dispatch: (
    job: SceneEvaluationJob
  ) => Promise<SceneRuntimeBatchResponse>;
  private timer: NodeJS.Timeout | null = null;
  private runInProgress = false;

  constructor(options: SceneRuntimeEvaluationWorkerOptions) {
    this.workerId = options.workerId;
    this.intervalMs = options.intervalMs;
    this.batchSize = options.batchSize;
    this.visibilityTimeoutMs = options.visibilityTimeoutMs;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
    this.dispatch = options.dispatch ?? dispatchSceneEvaluationJob;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async runOnce(
    occurredAt = this.now().toISOString()
  ): Promise<SceneRuntimeEvaluationWorkerRunResult> {
    if (this.runInProgress) {
      this.logger?.(
        "[scene-runtime-worker] skipped tick because the previous run is still in progress"
      );
      return {
        claimedCount: 0,
        completedCount: 0,
        failedCount: 0,
        evaluatedSceneCount: 0,
        matchedRunCount: 0,
        runCount: 0,
        skippedReason: "local_overlap"
      };
    }

    this.runInProgress = true;

    try {
      const claimedJobs = await sceneEvaluationJobRepository.claimNextBatch({
        workerId: this.workerId,
        limit: this.batchSize,
        now: occurredAt,
        visibilityTimeoutMs: this.visibilityTimeoutMs
      });
      const result: SceneRuntimeEvaluationWorkerRunResult = {
        claimedCount: claimedJobs.length,
        completedCount: 0,
        failedCount: 0,
        evaluatedSceneCount: 0,
        matchedRunCount: 0,
        runCount: 0
      };

      for (const job of claimedJobs) {
        try {
          const batch = await this.dispatch(job);
          await sceneEvaluationJobRepository.complete(job.jobId, occurredAt);
          result.completedCount += 1;
          result.evaluatedSceneCount += batch.evaluatedSceneCount;
          result.matchedRunCount += batch.matchedRunCount;
          result.runCount += batch.runs.length;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await sceneEvaluationJobRepository.fail(job.jobId, occurredAt, message);
          result.failedCount += 1;
        }
      }

      if (result.claimedCount > 0) {
        this.logger?.(
          `[scene-runtime-worker] claimed ${result.claimedCount} job(s), completed ${result.completedCount}, failed ${result.failedCount}, executed ${result.runCount} run(s)`
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
      this.logger?.(`[scene-runtime-worker] run failed: ${message}`);
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

export function createSceneRuntimeEvaluationWorker(
  options: SceneRuntimeEvaluationWorkerOptions
): SceneRuntimeEvaluationWorker {
  return new SceneRuntimeEvaluationWorker(options);
}
