import type { Db } from "mongodb";

import type { OtaReleaseRecord } from "@jenix/shared";

import type { OtaRepository } from "./ota.model";

const otaReleaseCollectionName = "ota_releases";

export async function createMongoOtaRepository(
  database: Db
): Promise<OtaRepository> {
  const otaReleaseCollection =
    database.collection<OtaReleaseRecord>(otaReleaseCollectionName);

  await Promise.all([
    otaReleaseCollection.createIndex({ releaseId: 1 }, { unique: true }),
    otaReleaseCollection.createIndex({ pid: 1, hardwareRevision: 1, channel: 1, status: 1 }),
    otaReleaseCollection.createIndex({ pid: 1, version: 1 }),
    otaReleaseCollection.createIndex({ publishedAt: -1 })
  ]);

  return {
    async list() {
      return otaReleaseCollection.find({}).toArray();
    },
    async get(releaseId) {
      return (
        await otaReleaseCollection.findOne({
          releaseId
        })
      ) ?? undefined;
    },
    async save(record) {
      await otaReleaseCollection.replaceOne(
        { releaseId: record.releaseId },
        record,
        {
          upsert: true
        }
      );

      return record;
    },
    async reset() {
      await otaReleaseCollection.deleteMany({});
    }
  };
}
