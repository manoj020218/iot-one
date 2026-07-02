import { MongoServerError, type Db } from "mongodb";

import type {
  SceneSchedulerLeaseStore,
  SceneSchedulerLeaseStoreAcquireInput,
  SceneSchedulerLeaseStoreReleaseInput
} from "./scene.scheduler.coordinator";

const sceneSchedulerLeaseCollectionName = "scene_scheduler_leases";

interface SceneSchedulerLeaseDocument {
  _id: string;
  ownerId: string;
  leasedUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

export async function createMongoSceneSchedulerLeaseStore(
  database: Db
): Promise<SceneSchedulerLeaseStore> {
  const collection = database.collection<SceneSchedulerLeaseDocument>(
    sceneSchedulerLeaseCollectionName
  );

  await collection.createIndex({ leasedUntil: 1 });

  return {
    async tryAcquire(
      input: SceneSchedulerLeaseStoreAcquireInput
    ): Promise<boolean> {
      try {
        const lease = await collection.findOneAndUpdate(
          {
            _id: input.lockKey,
            $or: [
              {
                leasedUntil: {
                  $lte: input.now
                }
              },
              {
                ownerId: input.ownerId
              }
            ]
          },
          {
            $set: {
              ownerId: input.ownerId,
              leasedUntil: input.leasedUntil,
              updatedAt: input.now
            },
            $setOnInsert: {
              createdAt: input.now
            }
          },
          {
            upsert: true,
            returnDocument: "after"
          }
        );

        return lease?.ownerId === input.ownerId;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return false;
        }

        throw error;
      }
    },
    async release(input: SceneSchedulerLeaseStoreReleaseInput) {
      await collection.updateOne(
        {
          _id: input.lockKey,
          ownerId: input.ownerId
        },
        {
          $set: {
            leasedUntil: input.now,
            updatedAt: input.now
          }
        }
      );
    }
  };
}
