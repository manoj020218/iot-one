import type { Db } from "mongodb";

import type {
  AuthPersistenceStore,
  AuthRefreshSessionRecord,
  AuthUserRecord
} from "./auth.model";

const authUserCollectionName = "auth_users";
const authRefreshSessionCollectionName = "auth_refresh_sessions";

export async function createMongoAuthPersistenceStore(
  database: Db
): Promise<AuthPersistenceStore> {
  const authUserCollection =
    database.collection<AuthUserRecord>(authUserCollectionName);
  const authRefreshSessionCollection =
    database.collection<AuthRefreshSessionRecord>(authRefreshSessionCollectionName);

  await Promise.all([
    authUserCollection.createIndex({ userId: 1 }, { unique: true }),
    authUserCollection.createIndex({ email: 1 }, { unique: true }),
    authRefreshSessionCollection.createIndex({ sessionId: 1 }, { unique: true }),
    authRefreshSessionCollection.createIndex({ userId: 1, updatedAt: -1 }),
    authRefreshSessionCollection.createIndex({ expiresAt: 1 })
  ]);

  return {
    users: {
      async getByUserId(userId) {
        return (await authUserCollection.findOne({ userId })) ?? undefined;
      },
      async getByEmail(email) {
        return (
          await authUserCollection.findOne({
            email: email.trim().toLowerCase()
          })
        ) ?? undefined;
      },
      async save(record) {
        const normalizedRecord: AuthUserRecord = {
          ...record,
          email: record.email.trim().toLowerCase()
        };

        await authUserCollection.replaceOne(
          { userId: normalizedRecord.userId },
          normalizedRecord,
          {
            upsert: true
          }
        );

        return normalizedRecord;
      },
      async reset() {
        await authUserCollection.deleteMany({});
      }
    },
    refreshSessions: {
      async get(sessionId) {
        return (
          await authRefreshSessionCollection.findOne({
            sessionId
          })
        ) ?? undefined;
      },
      async save(record) {
        await authRefreshSessionCollection.replaceOne(
          { sessionId: record.sessionId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await authRefreshSessionCollection.deleteMany({});
      }
    }
  };
}
