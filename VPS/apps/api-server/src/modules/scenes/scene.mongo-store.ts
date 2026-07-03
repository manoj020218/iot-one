import { MongoServerError, type Db } from "mongodb";

import type { SceneRecord } from "@jenix/shared";

import type {
  SceneActionDispatchJob,
  SceneAuditEntry,
  SceneEvaluationJob,
  SceneRunHistoryEntry
} from "./scene.types";
import type {
  ClaimSceneEvaluationJobsInput,
  ClaimSceneActionDispatchJobsInput,
  ScenePersistenceStore
} from "./scene.model";

const sceneCollectionName = "scenes";
const sceneAuditCollectionName = "scene_audit_logs";
const sceneRunHistoryCollectionName = "scene_run_history";
const sceneActionDispatchCollectionName = "scene_action_dispatch_jobs";
const sceneEvaluationJobCollectionName = "scene_evaluation_jobs";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof MongoServerError &&
    error.code === 11000
  );
}

export async function createMongoScenePersistenceStore(
  database: Db
): Promise<ScenePersistenceStore> {
  const sceneCollection = database.collection<SceneRecord>(sceneCollectionName);
  const sceneAuditCollection =
    database.collection<SceneAuditEntry>(sceneAuditCollectionName);
  const sceneRunHistoryCollection =
    database.collection<SceneRunHistoryEntry>(sceneRunHistoryCollectionName);
  const sceneActionDispatchCollection =
    database.collection<SceneActionDispatchJob>(sceneActionDispatchCollectionName);
  const sceneEvaluationJobCollection =
    database.collection<SceneEvaluationJob>(sceneEvaluationJobCollectionName);

  await Promise.all([
    sceneCollection.createIndex({ sceneId: 1 }, { unique: true }),
    sceneCollection.createIndex({ homeId: 1, status: 1 }),
    sceneCollection.createIndex({ ownerUserId: 1, homeId: 1 }),
    sceneAuditCollection.createIndex({ sceneId: 1, occurredAt: -1 }),
    sceneRunHistoryCollection.createIndex({ sceneId: 1, triggeredAt: -1 }),
    sceneRunHistoryCollection.createIndex(
      { sceneId: 1, source: 1, dedupeKey: 1 },
      {
        unique: true,
        partialFilterExpression: {
          source: "schedule",
          dedupeKey: {
            $exists: true
          }
        }
      }
    ),
    sceneActionDispatchCollection.createIndex({ jobId: 1 }, { unique: true }),
    sceneActionDispatchCollection.createIndex({ sceneId: 1, requestedAt: 1 }),
    sceneActionDispatchCollection.createIndex({ runId: 1, requestedAt: 1 }),
    sceneActionDispatchCollection.createIndex({ status: 1, visibleAfter: 1, requestedAt: 1 }),
    sceneEvaluationJobCollection.createIndex({ jobId: 1 }, { unique: true }),
    sceneEvaluationJobCollection.createIndex({ homeId: 1, requestedAt: 1 }),
    sceneEvaluationJobCollection.createIndex({ status: 1, visibleAfter: 1, requestedAt: 1 })
  ]);

  async function claimOneDispatchJob(
    input: ClaimSceneActionDispatchJobsInput
  ): Promise<SceneActionDispatchJob | undefined> {
    const leaseExpiry = new Date(
      new Date(input.now).getTime() + input.visibilityTimeoutMs
    ).toISOString();

    const claimed = await sceneActionDispatchCollection.findOneAndUpdate(
      {
        $or: [
          {
            status: "queued",
            $or: [
              {
                visibleAfter: {
                  $exists: false
                }
              },
              {
                visibleAfter: {
                  $lte: input.now
                }
              }
            ]
          },
          {
            status: "processing",
            visibleAfter: {
              $lte: input.now
            }
          },
          {
            status: "dispatched",
            visibleAfter: {
              $lte: input.now
            }
          }
        ]
      },
      {
        $set: {
          status: "processing",
          processingWorkerId: input.workerId,
          processingStartedAt: input.now,
          visibleAfter: leaseExpiry
        },
        $inc: {
          attemptCount: 1
        }
      },
      {
        sort: {
          requestedAt: 1,
          jobId: 1
        },
        returnDocument: "after"
      }
    );

    return claimed ?? undefined;
  }

  async function claimOneEvaluationJob(
    input: ClaimSceneEvaluationJobsInput
  ): Promise<SceneEvaluationJob | undefined> {
    const leaseExpiry = new Date(
      new Date(input.now).getTime() + input.visibilityTimeoutMs
    ).toISOString();

    const claimed = await sceneEvaluationJobCollection.findOneAndUpdate(
      {
        $or: [
          {
            status: "queued",
            $or: [
              {
                visibleAfter: {
                  $exists: false
                }
              },
              {
                visibleAfter: {
                  $lte: input.now
                }
              }
            ]
          },
          {
            status: "processing",
            visibleAfter: {
              $lte: input.now
            }
          }
        ]
      },
      {
        $set: {
          status: "processing",
          processingWorkerId: input.workerId,
          processingStartedAt: input.now,
          visibleAfter: leaseExpiry
        },
        $inc: {
          attemptCount: 1
        }
      },
      {
        sort: {
          requestedAt: 1,
          jobId: 1
        },
        returnDocument: "after"
      }
    );

    return claimed ?? undefined;
  }

  return {
    scenes: {
      async get(sceneId) {
        return (await sceneCollection.findOne({ sceneId })) ?? undefined;
      },
      async list() {
        return sceneCollection.find({}).toArray();
      },
      async save(record) {
        await sceneCollection.replaceOne(
          { sceneId: record.sceneId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await sceneCollection.deleteMany({});
      }
    },
    audits: {
      async list(sceneId) {
        return sceneAuditCollection
          .find({ sceneId })
          .sort({ occurredAt: 1 })
          .toArray();
      },
      async append(entry) {
        await sceneAuditCollection.insertOne(entry);
      },
      async reset() {
        await sceneAuditCollection.deleteMany({});
      }
    },
    runHistory: {
      async list(sceneId) {
        return sceneRunHistoryCollection
          .find({ sceneId })
          .sort({ triggeredAt: 1 })
          .toArray();
      },
      async append(entry) {
        try {
          await sceneRunHistoryCollection.insertOne(entry);
          return true;
        } catch (error) {
          if (
            entry.source === "schedule" &&
            entry.dedupeKey !== undefined &&
            isDuplicateKeyError(error)
          ) {
            return false;
          }

          throw error;
        }
      },
      async reset() {
        await sceneRunHistoryCollection.deleteMany({});
      }
    },
    dispatches: {
      async get(jobId) {
        return (
          await sceneActionDispatchCollection.findOne({
            jobId
          })
        ) ?? undefined;
      },
      async listByScene(sceneId) {
        return sceneActionDispatchCollection
          .find({ sceneId })
          .sort({ requestedAt: 1, jobId: 1 })
          .toArray();
      },
      async listByRun(runId) {
        return sceneActionDispatchCollection
          .find({ runId })
          .sort({ requestedAt: 1, jobId: 1 })
          .toArray();
      },
      async enqueue(entries) {
        if (entries.length === 0) {
          return;
        }

        await sceneActionDispatchCollection.insertMany(entries, {
          ordered: true
        });
      },
      async claimNextBatch(input) {
        const claimedEntries: SceneActionDispatchJob[] = [];

        for (let index = 0; index < input.limit; index += 1) {
          const claimed = await claimOneDispatchJob(input);

          if (!claimed) {
            break;
          }

          claimedEntries.push(claimed);
        }

        return claimedEntries;
      },
      async markDispatched(jobId, dispatchedAt, visibleAfter) {
        await sceneActionDispatchCollection.updateOne(
          { jobId },
          {
            $set: {
              status: "dispatched",
              dispatchedAt,
              visibleAfter
            },
            $unset: {
              completedAt: "",
              failedAt: "",
              acknowledgedAt: "",
              lastError: ""
            }
          }
        );
      },
      async complete(jobId, completedAt, acknowledgedAt) {
        await sceneActionDispatchCollection.updateOne(
          { jobId },
          {
            $set: {
              status: "completed",
              completedAt,
              ...(acknowledgedAt ? { acknowledgedAt } : {})
            },
            $unset: {
              visibleAfter: "",
              lastError: ""
            }
          }
        );
      },
      async fail(jobId, failedAt, errorMessage) {
        await sceneActionDispatchCollection.updateOne(
          { jobId },
          {
            $set: {
              status: "failed",
              failedAt,
              lastError: errorMessage
            },
            $unset: {
              visibleAfter: ""
            }
          }
        );
      },
      async reset() {
        await sceneActionDispatchCollection.deleteMany({});
      }
    },
    evaluations: {
      async listByHome(homeId) {
        return sceneEvaluationJobCollection
          .find({ homeId })
          .sort({ requestedAt: 1, jobId: 1 })
          .toArray();
      },
      async enqueue(entries) {
        if (entries.length === 0) {
          return;
        }

        await sceneEvaluationJobCollection.insertMany(entries, {
          ordered: true
        });
      },
      async claimNextBatch(input) {
        const claimedEntries: SceneEvaluationJob[] = [];

        for (let index = 0; index < input.limit; index += 1) {
          const claimed = await claimOneEvaluationJob(input);

          if (!claimed) {
            break;
          }

          claimedEntries.push(claimed);
        }

        return claimedEntries;
      },
      async complete(jobId, completedAt) {
        await sceneEvaluationJobCollection.updateOne(
          { jobId },
          {
            $set: {
              status: "completed",
              completedAt
            },
            $unset: {
              visibleAfter: "",
              lastError: ""
            }
          }
        );
      },
      async fail(jobId, failedAt, errorMessage) {
        await sceneEvaluationJobCollection.updateOne(
          { jobId },
          {
            $set: {
              status: "failed",
              failedAt,
              lastError: errorMessage
            },
            $unset: {
              visibleAfter: ""
            }
          }
        );
      },
      async reset() {
        await sceneEvaluationJobCollection.deleteMany({});
      }
    }
  };
}
