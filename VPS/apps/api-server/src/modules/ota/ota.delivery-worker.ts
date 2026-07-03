import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import {
  otaDeliveryJobRepository,
  type ClaimOtaDeliveryJobsInput
} from "./ota.model";
import type { OtaDeliveryJob } from "./ota.types";

export interface OtaDeliveryWorkerOptions {
  workerId: string;
  intervalMs: number;
  batchSize: number;
  visibilityTimeoutMs: number;
  now?: () => Date;
  logger?: (message: string) => void;
  dispatch?: (job: OtaDeliveryJob) => Promise<"completed" | "dispatched">;
}

export interface OtaDeliveryWorkerRunResult {
  claimedCount: number;
  completedCount: number;
  dispatchedCount: number;
  failedCount: number;
  skippedReason?: "local_overlap";
}

async function dispatchOtaDeliveryJob(
  job: OtaDeliveryJob
): Promise<"completed" | "dispatched"> {
  const bridge = getRuntimeMqttBridge();

  if (!bridge) {
    return "completed";
  }

  await bridge.publishOtaRequest({
    requestId: job.requestId,
    deviceId: job.deviceId,
    homeId: job.homeId,
    pid: job.pid,
    channel: job.channel,
    targetVersion: job.targetVersion,
    artifactUrl: job.artifactUrl,
    checksum: job.checksum,
    requestedAt: job.requestedAt,
    requestedBy: job.requestedBy,
    ...(job.currentVersion ? { currentVersion: job.currentVersion } : {})
  });

  return "dispatched";
}

export class OtaDeliveryWorker {
  private readonly workerId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly visibilityTimeoutMs: number;
  private readonly now: () => Date;
  private readonly logger: ((message: string) => void) | undefined;
  private readonly dispatch: (
    job: OtaDeliveryJob
  ) => Promise<"completed" | "dispatched">;
  private timer: NodeJS.Timeout | null = null;
  private runInProgress = false;

  constructor(options: OtaDeliveryWorkerOptions) {
    this.workerId = options.workerId;
    this.intervalMs = options.intervalMs;
    this.batchSize = options.batchSize;
    this.visibilityTimeoutMs = options.visibilityTimeoutMs;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
    this.dispatch = options.dispatch ?? dispatchOtaDeliveryJob;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  private createClaimInput(now: string): ClaimOtaDeliveryJobsInput {
    return {
      workerId: this.workerId,
      limit: this.batchSize,
      now,
      visibilityTimeoutMs: this.visibilityTimeoutMs
    };
  }

  async runOnce(
    occurredAt = this.now().toISOString()
  ): Promise<OtaDeliveryWorkerRunResult> {
    if (this.runInProgress) {
      this.logger?.(
        "[ota-delivery-worker] skipped tick because the previous run is still in progress"
      );
      return {
        claimedCount: 0,
        completedCount: 0,
        dispatchedCount: 0,
        failedCount: 0,
        skippedReason: "local_overlap"
      };
    }

    this.runInProgress = true;

    try {
      const claimedJobs = await otaDeliveryJobRepository.claimNextBatch(
        this.createClaimInput(occurredAt)
      );
      const result: OtaDeliveryWorkerRunResult = {
        claimedCount: claimedJobs.length,
        completedCount: 0,
        dispatchedCount: 0,
        failedCount: 0
      };

      for (const job of claimedJobs) {
        try {
          const dispatchResult = await this.dispatch(job);

          if (dispatchResult === "dispatched") {
            const visibleAfter = new Date(
              new Date(occurredAt).getTime() + this.visibilityTimeoutMs
            ).toISOString();
            await otaDeliveryJobRepository.markDispatched(
              job.requestId,
              occurredAt,
              visibleAfter
            );
            result.dispatchedCount += 1;
          } else {
            await otaDeliveryJobRepository.complete(job.requestId, occurredAt);
            result.completedCount += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await otaDeliveryJobRepository.fail(job.requestId, occurredAt, message);
          result.failedCount += 1;
        }
      }

      if (result.claimedCount > 0) {
        this.logger?.(
          `[ota-delivery-worker] claimed ${result.claimedCount} job(s), completed ${result.completedCount}, dispatched ${result.dispatchedCount}, failed ${result.failedCount}`
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
      this.logger?.(`[ota-delivery-worker] run failed: ${message}`);
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

export function createOtaDeliveryWorker(
  options: OtaDeliveryWorkerOptions
): OtaDeliveryWorker {
  return new OtaDeliveryWorker(options);
}
