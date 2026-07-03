import type { OtaReleaseRecord } from "@jenix/shared";

import type { OtaDeliveryJob } from "./ota.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface OtaRepository {
  list(): Promise<OtaReleaseRecord[]>;
  get(releaseId: string): Promise<OtaReleaseRecord | undefined>;
  save(record: OtaReleaseRecord): Promise<OtaReleaseRecord>;
  reset(): Promise<void>;
}

export interface ClaimOtaDeliveryJobsInput {
  workerId: string;
  limit: number;
  now: string;
  visibilityTimeoutMs: number;
}

export interface OtaDeliveryJobRepository {
  get(requestId: string): Promise<OtaDeliveryJob | undefined>;
  listByDevice(deviceId: string): Promise<OtaDeliveryJob[]>;
  listAll(): Promise<OtaDeliveryJob[]>;
  enqueue(job: OtaDeliveryJob): Promise<OtaDeliveryJob>;
  claimNextBatch(input: ClaimOtaDeliveryJobsInput): Promise<OtaDeliveryJob[]>;
  markDispatched(
    requestId: string,
    dispatchedAt: string,
    visibleAfter: string
  ): Promise<void>;
  complete(
    requestId: string,
    completedAt: string,
    acknowledgedAt?: string
  ): Promise<void>;
  fail(requestId: string, failedAt: string, errorMessage: string): Promise<void>;
  reset(): Promise<void>;
}

function createInMemoryOtaRepository(): OtaRepository {
  const otaReleaseStore = new Map<string, OtaReleaseRecord>();

  return {
    async list() {
      return Array.from(otaReleaseStore.values(), (record) => clone(record));
    },
    async get(releaseId) {
      const record = otaReleaseStore.get(releaseId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      otaReleaseStore.set(record.releaseId, clone(record));
      return clone(record);
    },
    async reset() {
      otaReleaseStore.clear();
    }
  };
}

function createInMemoryOtaDeliveryJobRepository(): OtaDeliveryJobRepository {
  const otaDeliveryJobStore = new Map<string, OtaDeliveryJob>();

  return {
    async get(requestId) {
      const record = otaDeliveryJobStore.get(requestId);
      return record ? clone(record) : undefined;
    },
    async listByDevice(deviceId) {
      return Array.from(otaDeliveryJobStore.values())
        .filter((record) => record.deviceId === deviceId)
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .map((record) => clone(record));
    },
    async listAll() {
      return Array.from(otaDeliveryJobStore.values())
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .map((record) => clone(record));
    },
    async enqueue(job) {
      otaDeliveryJobStore.set(job.requestId, clone(job));
      return clone(job);
    },
    async claimNextBatch(input) {
      const nowValue = new Date(input.now).getTime();
      const leaseExpiry = new Date(nowValue + input.visibilityTimeoutMs).toISOString();
      const claimable = Array.from(otaDeliveryJobStore.values())
        .filter((entry) => {
          const visibleAfter = entry.visibleAfter
            ? new Date(entry.visibleAfter).getTime()
            : Number.NEGATIVE_INFINITY;

          if (entry.status === "queued") {
            return visibleAfter <= nowValue;
          }

          return (
            (entry.status === "processing" || entry.status === "dispatched") &&
            visibleAfter <= nowValue
          );
        })
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .slice(0, input.limit);

      for (const entry of claimable) {
        otaDeliveryJobStore.set(entry.requestId, {
          ...entry,
          status: "processing",
          attemptCount: entry.attemptCount + 1,
          processingWorkerId: input.workerId,
          processingStartedAt: input.now,
          visibleAfter: leaseExpiry
        });
      }

      return claimable.map((entry) =>
        clone({
          ...entry,
          status: "processing",
          attemptCount: entry.attemptCount + 1,
          processingWorkerId: input.workerId,
          processingStartedAt: input.now,
          visibleAfter: leaseExpiry
        })
      );
    },
    async markDispatched(requestId, dispatchedAt, visibleAfter) {
      const existing = otaDeliveryJobStore.get(requestId);

      if (!existing) {
        return;
      }

      const {
        completedAt: _completedAt,
        failedAt: _failedAt,
        acknowledgedAt: _acknowledgedAt,
        lastError: _lastError,
        ...baseRecord
      } = existing;
      otaDeliveryJobStore.set(requestId, {
        ...baseRecord,
        status: "dispatched",
        dispatchedAt,
        visibleAfter
      });
    },
    async complete(requestId, completedAt, acknowledgedAt) {
      const existing = otaDeliveryJobStore.get(requestId);

      if (!existing) {
        return;
      }

      const {
        visibleAfter: _visibleAfter,
        lastError: _lastError,
        ...baseRecord
      } = existing;
      otaDeliveryJobStore.set(requestId, {
        ...baseRecord,
        status: "completed",
        completedAt,
        ...(acknowledgedAt ? { acknowledgedAt } : {})
      });
    },
    async fail(requestId, failedAt, errorMessage) {
      const existing = otaDeliveryJobStore.get(requestId);

      if (!existing) {
        return;
      }

      const {
        visibleAfter: _visibleAfter,
        ...baseRecord
      } = existing;
      otaDeliveryJobStore.set(requestId, {
        ...baseRecord,
        status: "failed",
        failedAt,
        lastError: errorMessage
      });
    },
    async reset() {
      otaDeliveryJobStore.clear();
    }
  };
}

let activeOtaRepository = createInMemoryOtaRepository();
let activeOtaDeliveryJobRepository = createInMemoryOtaDeliveryJobRepository();

export function useOtaRepository(repository: OtaRepository) {
  activeOtaRepository = repository;
}

export function useOtaDeliveryJobRepository(repository: OtaDeliveryJobRepository) {
  activeOtaDeliveryJobRepository = repository;
}

export function resetOtaRepository() {
  activeOtaRepository = createInMemoryOtaRepository();
  activeOtaDeliveryJobRepository = createInMemoryOtaDeliveryJobRepository();
}

export const otaRepository: OtaRepository = {
  list() {
    return activeOtaRepository.list();
  },
  get(releaseId) {
    return activeOtaRepository.get(releaseId);
  },
  save(record) {
    return activeOtaRepository.save(record);
  },
  reset() {
    return activeOtaRepository.reset();
  }
};

export const otaDeliveryJobRepository: OtaDeliveryJobRepository = {
  get(requestId) {
    return activeOtaDeliveryJobRepository.get(requestId);
  },
  listByDevice(deviceId) {
    return activeOtaDeliveryJobRepository.listByDevice(deviceId);
  },
  listAll() {
    return activeOtaDeliveryJobRepository.listAll();
  },
  enqueue(job) {
    return activeOtaDeliveryJobRepository.enqueue(job);
  },
  claimNextBatch(input) {
    return activeOtaDeliveryJobRepository.claimNextBatch(input);
  },
  markDispatched(requestId, dispatchedAt, visibleAfter) {
    return activeOtaDeliveryJobRepository.markDispatched(
      requestId,
      dispatchedAt,
      visibleAfter
    );
  },
  complete(requestId, completedAt, acknowledgedAt) {
    return activeOtaDeliveryJobRepository.complete(
      requestId,
      completedAt,
      acknowledgedAt
    );
  },
  fail(requestId, failedAt, errorMessage) {
    return activeOtaDeliveryJobRepository.fail(
      requestId,
      failedAt,
      errorMessage
    );
  },
  reset() {
    return activeOtaDeliveryJobRepository.reset();
  }
};
