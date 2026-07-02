import { MongoServerError, type Db } from "mongodb";

import type { SceneRecord } from "@jenix/shared";

import type { SceneAuditEntry, SceneRunHistoryEntry } from "./scene.types";
import type { ScenePersistenceStore } from "./scene.model";

const sceneCollectionName = "scenes";
const sceneAuditCollectionName = "scene_audit_logs";
const sceneRunHistoryCollectionName = "scene_run_history";

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
    )
  ]);

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
    }
  };
}
