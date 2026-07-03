import type { Db } from "mongodb";

import type {
  ApiKeyCreateResult,
  ApiKeyRecord,
  ApiPackageRecord
} from "@jenix/shared";

import type {
  ApiAccessPersistenceStore,
  ApiKeySecretRepository
} from "./api-access.model";

const apiPackageCollectionName = "api_packages";
const apiKeyCollectionName = "api_keys";
const apiKeySecretCollectionName = "api_key_secrets";

interface ApiKeySecretRecord {
  keyId: string;
  secret: string;
}

export async function createMongoApiAccessPersistenceStore(
  database: Db
): Promise<ApiAccessPersistenceStore> {
  const apiPackageCollection =
    database.collection<ApiPackageRecord>(apiPackageCollectionName);
  const apiKeyCollection =
    database.collection<ApiKeyRecord>(apiKeyCollectionName);
  const apiKeySecretCollection =
    database.collection<ApiKeySecretRecord>(apiKeySecretCollectionName);

  await Promise.all([
    apiPackageCollection.createIndex({ packageId: 1 }, { unique: true }),
    apiPackageCollection.createIndex({ pid: 1, status: 1 }),
    apiKeyCollection.createIndex({ keyId: 1 }, { unique: true }),
    apiKeyCollection.createIndex({ homeId: 1, status: 1 }),
    apiKeyCollection.createIndex({ packageId: 1, status: 1 }),
    apiKeySecretCollection.createIndex({ keyId: 1 }, { unique: true }),
    apiKeySecretCollection.createIndex({ secret: 1 }, { unique: true })
  ]);

  const secrets: ApiKeySecretRepository = {
    async store(result: ApiKeyCreateResult) {
      await apiKeySecretCollection.replaceOne(
        { keyId: result.keyId },
        {
          keyId: result.keyId,
          secret: result.secret
        },
        {
          upsert: true
        }
      );
    },
    async findKeyBySecret(secret) {
      const secretRecord = await apiKeySecretCollection.findOne({ secret });

      if (!secretRecord) {
        return undefined;
      }

      return (await apiKeyCollection.findOne({ keyId: secretRecord.keyId })) ?? undefined;
    },
    async reset() {
      await apiKeySecretCollection.deleteMany({});
    }
  };

  return {
    packages: {
      async list() {
        return apiPackageCollection.find({}).toArray();
      },
      async get(packageId) {
        return (
          await apiPackageCollection.findOne({
            packageId
          })
        ) ?? undefined;
      },
      async save(record) {
        await apiPackageCollection.replaceOne(
          { packageId: record.packageId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await apiPackageCollection.deleteMany({});
      }
    },
    keys: {
      async list() {
        return apiKeyCollection.find({}).toArray();
      },
      async get(keyId) {
        return (
          await apiKeyCollection.findOne({
            keyId
          })
        ) ?? undefined;
      },
      async save(record) {
        await apiKeyCollection.replaceOne(
          { keyId: record.keyId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await apiKeyCollection.deleteMany({});
      }
    },
    secrets
  };
}
