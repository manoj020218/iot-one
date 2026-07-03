import type { SceneRecord } from "@jenix/shared";

import type {
  SceneActionDispatchJob,
  SceneAuditEntry,
  SceneEvaluationJob,
  SceneRunHistoryEntry
} from "./scene.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface SceneRepository {
  get(sceneId: string): Promise<SceneRecord | undefined>;
  list(): Promise<SceneRecord[]>;
  save(record: SceneRecord): Promise<SceneRecord>;
  reset(): Promise<void>;
}

export interface SceneAuditRepository {
  list(sceneId: string): Promise<SceneAuditEntry[]>;
  append(entry: SceneAuditEntry): Promise<void>;
  reset(): Promise<void>;
}

export interface SceneRunHistoryRepository {
  list(sceneId: string): Promise<SceneRunHistoryEntry[]>;
  append(entry: SceneRunHistoryEntry): Promise<boolean>;
  reset(): Promise<void>;
}

export interface ClaimSceneActionDispatchJobsInput {
  workerId: string;
  limit: number;
  now: string;
  visibilityTimeoutMs: number;
}

export interface SceneActionDispatchRepository {
  get(jobId: string): Promise<SceneActionDispatchJob | undefined>;
  listByScene(sceneId: string): Promise<SceneActionDispatchJob[]>;
  listByRun(runId: string): Promise<SceneActionDispatchJob[]>;
  enqueue(entries: SceneActionDispatchJob[]): Promise<void>;
  claimNextBatch(
    input: ClaimSceneActionDispatchJobsInput
  ): Promise<SceneActionDispatchJob[]>;
  markDispatched(
    jobId: string,
    dispatchedAt: string,
    visibleAfter: string
  ): Promise<void>;
  complete(
    jobId: string,
    completedAt: string,
    acknowledgedAt?: string
  ): Promise<void>;
  fail(jobId: string, failedAt: string, errorMessage: string): Promise<void>;
  reset(): Promise<void>;
}

export interface ClaimSceneEvaluationJobsInput {
  workerId: string;
  limit: number;
  now: string;
  visibilityTimeoutMs: number;
}

export interface SceneEvaluationJobRepository {
  listByHome(homeId: string): Promise<SceneEvaluationJob[]>;
  enqueue(entries: SceneEvaluationJob[]): Promise<void>;
  claimNextBatch(
    input: ClaimSceneEvaluationJobsInput
  ): Promise<SceneEvaluationJob[]>;
  complete(jobId: string, completedAt: string): Promise<void>;
  fail(jobId: string, failedAt: string, errorMessage: string): Promise<void>;
  reset(): Promise<void>;
}

export interface ScenePersistenceStore {
  scenes: SceneRepository;
  audits: SceneAuditRepository;
  runHistory: SceneRunHistoryRepository;
  dispatches: SceneActionDispatchRepository;
  evaluations: SceneEvaluationJobRepository;
}

function createInMemoryScenePersistenceStore(): ScenePersistenceStore {
  const sceneStore = new Map<string, SceneRecord>();
  const sceneAuditStore = new Map<string, SceneAuditEntry[]>();
  const sceneRunHistoryStore = new Map<string, SceneRunHistoryEntry[]>();
  const sceneActionDispatchStore = new Map<string, SceneActionDispatchJob>();
  const sceneEvaluationJobStore = new Map<string, SceneEvaluationJob>();

  const scenes: SceneRepository = {
    async get(sceneId: string) {
      const record = sceneStore.get(sceneId);
      return record ? clone(record) : undefined;
    },
    async list() {
      return Array.from(sceneStore.values()).map(clone);
    },
    async save(record: SceneRecord) {
      sceneStore.set(record.sceneId, clone(record));
      return clone(record);
    },
    async reset() {
      sceneStore.clear();
    }
  };

  const audits: SceneAuditRepository = {
    async list(sceneId: string) {
      return clone(sceneAuditStore.get(sceneId) ?? []);
    },
    async append(entry: SceneAuditEntry) {
      const nextEntries = [...(await audits.list(entry.sceneId)), clone(entry)];
      sceneAuditStore.set(entry.sceneId, nextEntries);
    },
    async reset() {
      sceneAuditStore.clear();
    }
  };

  const runHistory: SceneRunHistoryRepository = {
    async list(sceneId: string) {
      return clone(sceneRunHistoryStore.get(sceneId) ?? []);
    },
    async append(entry: SceneRunHistoryEntry) {
      const existing = await runHistory.list(entry.sceneId);
      const hasDuplicateScheduleEntry =
        entry.source === "schedule" &&
        entry.dedupeKey !== undefined &&
        existing.some(
          (current) =>
            current.source === "schedule" && current.dedupeKey === entry.dedupeKey
        );

      if (hasDuplicateScheduleEntry) {
        return false;
      }

      sceneRunHistoryStore.set(entry.sceneId, [...existing, clone(entry)]);
      return true;
    },
    async reset() {
      sceneRunHistoryStore.clear();
    }
  };

  const dispatches: SceneActionDispatchRepository = {
    async get(jobId) {
      const record = sceneActionDispatchStore.get(jobId);
      return record ? clone(record) : undefined;
    },
    async listByScene(sceneId) {
      return Array.from(sceneActionDispatchStore.values())
        .filter((entry) => entry.sceneId === sceneId)
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .map(clone);
    },
    async listByRun(runId) {
      return Array.from(sceneActionDispatchStore.values())
        .filter((entry) => entry.runId === runId)
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .map(clone);
    },
    async enqueue(entries) {
      for (const entry of entries) {
        sceneActionDispatchStore.set(entry.jobId, clone(entry));
      }
    },
    async claimNextBatch(input) {
      const nowValue = new Date(input.now).getTime();
      const leaseExpiry = new Date(nowValue + input.visibilityTimeoutMs).toISOString();
      const claimable = Array.from(sceneActionDispatchStore.values())
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
        sceneActionDispatchStore.set(entry.jobId, {
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
    async markDispatched(jobId, dispatchedAt, visibleAfter) {
      const existing = sceneActionDispatchStore.get(jobId);

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
      sceneActionDispatchStore.set(jobId, {
        ...baseRecord,
        status: "dispatched",
        dispatchedAt,
        visibleAfter
      });
    },
    async complete(jobId, completedAt, acknowledgedAt) {
      const existing = sceneActionDispatchStore.get(jobId);

      if (!existing) {
        return;
      }

      const {
        visibleAfter: _visibleAfter,
        lastError: _lastError,
        ...baseRecord
      } = existing;
      sceneActionDispatchStore.set(jobId, {
        ...baseRecord,
        status: "completed",
        completedAt,
        ...(acknowledgedAt ? { acknowledgedAt } : {})
      });
    },
    async fail(jobId, failedAt, errorMessage) {
      const existing = sceneActionDispatchStore.get(jobId);

      if (!existing) {
        return;
      }

      const {
        visibleAfter: _visibleAfter,
        ...baseRecord
      } = existing;
      sceneActionDispatchStore.set(jobId, {
        ...baseRecord,
        status: "failed",
        failedAt,
        lastError: errorMessage
      });
    },
    async reset() {
      sceneActionDispatchStore.clear();
    }
  };

  const evaluations: SceneEvaluationJobRepository = {
    async listByHome(homeId) {
      return Array.from(sceneEvaluationJobStore.values())
        .filter((entry) => entry.homeId === homeId)
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .map(clone);
    },
    async enqueue(entries) {
      for (const entry of entries) {
        sceneEvaluationJobStore.set(entry.jobId, clone(entry));
      }
    },
    async claimNextBatch(input) {
      const nowValue = new Date(input.now).getTime();
      const leaseExpiry = new Date(nowValue + input.visibilityTimeoutMs).toISOString();
      const claimable = Array.from(sceneEvaluationJobStore.values())
        .filter((entry) => {
          const visibleAfter = entry.visibleAfter
            ? new Date(entry.visibleAfter).getTime()
            : Number.NEGATIVE_INFINITY;

          if (entry.status === "queued") {
            return visibleAfter <= nowValue;
          }

          return entry.status === "processing" && visibleAfter <= nowValue;
        })
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
        .slice(0, input.limit);

      for (const entry of claimable) {
        sceneEvaluationJobStore.set(entry.jobId, {
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
    async complete(jobId, completedAt) {
      const existing = sceneEvaluationJobStore.get(jobId);

      if (!existing) {
        return;
      }

      const {
        visibleAfter: _visibleAfter,
        lastError: _lastError,
        ...baseRecord
      } = existing;
      sceneEvaluationJobStore.set(jobId, {
        ...baseRecord,
        status: "completed",
        completedAt
      });
    },
    async fail(jobId, failedAt, errorMessage) {
      const existing = sceneEvaluationJobStore.get(jobId);

      if (!existing) {
        return;
      }

      const {
        visibleAfter: _visibleAfter,
        ...baseRecord
      } = existing;
      sceneEvaluationJobStore.set(jobId, {
        ...baseRecord,
        status: "failed",
        failedAt,
        lastError: errorMessage
      });
    },
    async reset() {
      sceneEvaluationJobStore.clear();
    }
  };

  return {
    scenes,
    audits,
    runHistory,
    dispatches,
    evaluations
  };
}

let activeScenePersistenceStore: ScenePersistenceStore =
  createInMemoryScenePersistenceStore();

export function useScenePersistenceStore(store: ScenePersistenceStore) {
  activeScenePersistenceStore = store;
}

export function resetScenePersistenceStore() {
  activeScenePersistenceStore = createInMemoryScenePersistenceStore();
}

export const sceneRepository: SceneRepository = {
  get(sceneId) {
    return activeScenePersistenceStore.scenes.get(sceneId);
  },
  list() {
    return activeScenePersistenceStore.scenes.list();
  },
  save(record) {
    return activeScenePersistenceStore.scenes.save(record);
  },
  reset() {
    return activeScenePersistenceStore.scenes.reset();
  }
};

export const sceneAuditRepository: SceneAuditRepository = {
  list(sceneId) {
    return activeScenePersistenceStore.audits.list(sceneId);
  },
  append(entry) {
    return activeScenePersistenceStore.audits.append(entry);
  },
  reset() {
    return activeScenePersistenceStore.audits.reset();
  }
};

export const sceneRunHistoryRepository: SceneRunHistoryRepository = {
  list(sceneId) {
    return activeScenePersistenceStore.runHistory.list(sceneId);
  },
  append(entry) {
    return activeScenePersistenceStore.runHistory.append(entry);
  },
  reset() {
    return activeScenePersistenceStore.runHistory.reset();
  }
};

export const sceneActionDispatchRepository: SceneActionDispatchRepository = {
  get(jobId) {
    return activeScenePersistenceStore.dispatches.get(jobId);
  },
  listByScene(sceneId) {
    return activeScenePersistenceStore.dispatches.listByScene(sceneId);
  },
  listByRun(runId) {
    return activeScenePersistenceStore.dispatches.listByRun(runId);
  },
  enqueue(entries) {
    return activeScenePersistenceStore.dispatches.enqueue(entries);
  },
  claimNextBatch(input) {
    return activeScenePersistenceStore.dispatches.claimNextBatch(input);
  },
  markDispatched(jobId, dispatchedAt, visibleAfter) {
    return activeScenePersistenceStore.dispatches.markDispatched(
      jobId,
      dispatchedAt,
      visibleAfter
    );
  },
  complete(jobId, completedAt, acknowledgedAt) {
    return activeScenePersistenceStore.dispatches.complete(
      jobId,
      completedAt,
      acknowledgedAt
    );
  },
  fail(jobId, failedAt, errorMessage) {
    return activeScenePersistenceStore.dispatches.fail(
      jobId,
      failedAt,
      errorMessage
    );
  },
  reset() {
    return activeScenePersistenceStore.dispatches.reset();
  }
};

export const sceneEvaluationJobRepository: SceneEvaluationJobRepository = {
  listByHome(homeId) {
    return activeScenePersistenceStore.evaluations.listByHome(homeId);
  },
  enqueue(entries) {
    return activeScenePersistenceStore.evaluations.enqueue(entries);
  },
  claimNextBatch(input) {
    return activeScenePersistenceStore.evaluations.claimNextBatch(input);
  },
  complete(jobId, completedAt) {
    return activeScenePersistenceStore.evaluations.complete(jobId, completedAt);
  },
  fail(jobId, failedAt, errorMessage) {
    return activeScenePersistenceStore.evaluations.fail(
      jobId,
      failedAt,
      errorMessage
    );
  },
  reset() {
    return activeScenePersistenceStore.evaluations.reset();
  }
};
