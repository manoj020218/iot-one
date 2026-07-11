import type {
  HomeMemberRecord,
  HomeShareCodeRecord
} from "@jenix/shared";
import type { Db } from "mongodb";

import type {
  HomeAuditEntry,
  HomeUserProfile,
  StoredHomeRecord
} from "./home.types";
import type { HomePersistenceStore } from "./home.model";

const homeCollectionName = "homes";
const homeMemberCollectionName = "home_members";
const homeShareCodeCollectionName = "home_share_codes";
const homeUserProfileCollectionName = "home_user_profiles";
const homeAuditCollectionName = "home_audit_logs";

export async function createMongoHomePersistenceStore(
  database: Db
): Promise<HomePersistenceStore> {
  const homeCollection = database.collection<StoredHomeRecord>(homeCollectionName);
  const homeMemberCollection =
    database.collection<HomeMemberRecord>(homeMemberCollectionName);
  const homeShareCodeCollection =
    database.collection<HomeShareCodeRecord>(homeShareCodeCollectionName);
  const homeUserProfileCollection =
    database.collection<HomeUserProfile>(homeUserProfileCollectionName);
  const homeAuditCollection =
    database.collection<HomeAuditEntry>(homeAuditCollectionName);

  await Promise.all([
    homeCollection.createIndex({ homeId: 1 }, { unique: true }),
    homeCollection.createIndex(
      { ownerUserId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: {
          isDefault: true
        }
      }
    ),
    homeCollection.createIndex({ ownerUserId: 1, updatedAt: -1 }),
    homeMemberCollection.createIndex({ membershipId: 1 }, { unique: true }),
    homeMemberCollection.createIndex({ homeId: 1, userId: 1 }, { unique: true }),
    homeMemberCollection.createIndex({ userId: 1, updatedAt: -1 }),
    homeShareCodeCollection.createIndex({ shareCodeId: 1 }, { unique: true }),
    homeShareCodeCollection.createIndex({ code: 1 }, { unique: true }),
    homeShareCodeCollection.createIndex({ homeId: 1, createdAt: -1 }),
    homeUserProfileCollection.createIndex({ userId: 1 }, { unique: true }),
    homeAuditCollection.createIndex({ homeId: 1, occurredAt: -1 })
  ]);

  return {
    homes: {
      async get(homeId) {
        return (await homeCollection.findOne({ homeId })) ?? undefined;
      },
      async list() {
        return homeCollection.find({}).toArray();
      },
      async findDefaultByOwner(ownerUserId) {
        return (
          await homeCollection.findOne({
            ownerUserId,
            isDefault: true
          })
        ) ?? undefined;
      },
      async save(record) {
        await homeCollection.replaceOne(
          { homeId: record.homeId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async remove(homeId) {
        await homeCollection.deleteOne({ homeId });
      },
      async reset() {
        await homeCollection.deleteMany({});
      }
    },
    members: {
      async listByHome(homeId) {
        return homeMemberCollection
          .find({ homeId })
          .sort({ role: 1, name: 1, userId: 1 })
          .toArray();
      },
      async listByUser(userId) {
        return homeMemberCollection
          .find({ userId })
          .sort({ updatedAt: -1, homeId: 1 })
          .toArray();
      },
      async find(homeId, userId) {
        return (await homeMemberCollection.findOne({ homeId, userId })) ?? undefined;
      },
      async save(record) {
        await homeMemberCollection.replaceOne(
          { membershipId: record.membershipId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async remove(_homeId, membershipId) {
        await homeMemberCollection.deleteOne({ membershipId });
      },
      async removeByHome(homeId) {
        await homeMemberCollection.deleteMany({ homeId });
      },
      async reset() {
        await homeMemberCollection.deleteMany({});
      }
    },
    shareCodes: {
      async listByHome(homeId) {
        return homeShareCodeCollection
          .find({ homeId })
          .sort({ createdAt: -1, shareCodeId: 1 })
          .toArray();
      },
      async getByCode(code) {
        return (
          await homeShareCodeCollection.findOne({
            code: code.trim().toUpperCase()
          })
        ) ?? undefined;
      },
      async save(record) {
        await homeShareCodeCollection.replaceOne(
          { shareCodeId: record.shareCodeId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async removeByHome(homeId) {
        await homeShareCodeCollection.deleteMany({ homeId });
      },
      async reset() {
        await homeShareCodeCollection.deleteMany({});
      }
    },
    userProfiles: {
      async get(userId) {
        return (await homeUserProfileCollection.findOne({ userId })) ?? undefined;
      },
      async save(record) {
        await homeUserProfileCollection.replaceOne(
          { userId: record.userId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await homeUserProfileCollection.deleteMany({});
      }
    },
    audits: {
      async listByHome(homeId) {
        return homeAuditCollection
          .find({ homeId })
          .sort({ occurredAt: 1, auditId: 1 })
          .toArray();
      },
      async append(record) {
        await homeAuditCollection.insertOne(record);
      },
      async removeByHome(homeId) {
        await homeAuditCollection.deleteMany({ homeId });
      },
      async reset() {
        await homeAuditCollection.deleteMany({});
      }
    }
  };
}
