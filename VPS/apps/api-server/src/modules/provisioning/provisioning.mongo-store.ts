import type { Db } from "mongodb";

import type { ProvisioningIntentRecord } from "./provisioning.types";
import type { ProvisioningRepository } from "./provisioning.model";

const provisioningCollectionName = "provisioning_intents";

export async function createMongoProvisioningRepository(
  database: Db
): Promise<ProvisioningRepository> {
  const provisioningCollection =
    database.collection<ProvisioningIntentRecord>(provisioningCollectionName);

  await Promise.all([
    provisioningCollection.createIndex({ provisioningId: 1 }, { unique: true }),
    provisioningCollection.createIndex({ userId: 1, createdAt: -1 }),
    provisioningCollection.createIndex({ homeId: 1, createdAt: -1 }),
    provisioningCollection.createIndex({ status: 1, updatedAt: -1 })
  ]);

  return {
    async get(provisioningId) {
      return (
        await provisioningCollection.findOne({ provisioningId })
      ) ?? undefined;
    },
    async save(record) {
      await provisioningCollection.replaceOne(
        { provisioningId: record.provisioningId },
        record,
        {
          upsert: true
        }
      );

      return record;
    },
    async reset() {
      await provisioningCollection.deleteMany({});
    }
  };
}
