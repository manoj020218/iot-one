import type { Db } from "mongodb";

import type { DeviceRecord } from "@jenix/shared";

import type { DeviceRepository } from "./device.model";

const deviceCollectionName = "devices";

export async function createMongoDeviceRepository(
  database: Db
): Promise<DeviceRepository> {
  const deviceCollection = database.collection<DeviceRecord>(deviceCollectionName);

  await Promise.all([
    deviceCollection.createIndex({ deviceId: 1 }, { unique: true }),
    deviceCollection.createIndex({ homeId: 1, createdAt: -1 }),
    deviceCollection.createIndex({ ownerUserId: 1, homeId: 1 }),
    deviceCollection.createIndex({ pid: 1, homeId: 1 }),
    deviceCollection.createIndex({ homeId: 1, lastSeenAt: -1 })
  ]);

  return {
    async list() {
      return deviceCollection.find({}).toArray();
    },
    async get(deviceId) {
      return (await deviceCollection.findOne({ deviceId })) ?? undefined;
    },
    async save(record) {
      await deviceCollection.replaceOne(
        { deviceId: record.deviceId },
        record,
        {
          upsert: true
        }
      );

      return record;
    },
    async reset() {
      await deviceCollection.deleteMany({});
    }
  };
}
