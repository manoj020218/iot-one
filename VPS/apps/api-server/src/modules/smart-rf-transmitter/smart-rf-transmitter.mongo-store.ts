import type { Db } from "mongodb";

import type { SmartRfTransmitterPersistenceStore } from "./smart-rf-transmitter.model";
import type { SmartRfButtonProfile, SmartRfCommandLogRecord } from "./smart-rf-transmitter.types";

const profileCollectionName = "smart_rf_transmitter_profiles";
const logCollectionName = "smart_rf_transmitter_logs";
const maxLogEntriesPerDevice = 300;

export async function createMongoSmartRfTransmitterPersistenceStore(
  database: Db
): Promise<SmartRfTransmitterPersistenceStore> {
  const profileCollection =
    database.collection<SmartRfButtonProfile>(profileCollectionName);
  const logCollection = database.collection<SmartRfCommandLogRecord>(logCollectionName);

  await Promise.all([
    profileCollection.createIndex({ deviceId: 1, profileId: 1 }, { unique: true }),
    logCollection.createIndex({ deviceId: 1, timestamp: -1 })
  ]);

  return {
    profiles: {
      async listByDevice(deviceId) {
        return profileCollection
          .find({ deviceId })
          .sort({ profileId: 1 })
          .toArray();
      },
      async get(deviceId, profileId) {
        return (await profileCollection.findOne({ deviceId, profileId })) ?? undefined;
      },
      async save(record) {
        await profileCollection.replaceOne(
          { deviceId: record.deviceId, profileId: record.profileId },
          record,
          { upsert: true }
        );
        return record;
      },
      async remove(deviceId, profileId) {
        await profileCollection.deleteOne({ deviceId, profileId });
      },
      async reset() {
        await profileCollection.deleteMany({});
      }
    },
    logs: {
      async listByDevice(deviceId) {
        return logCollection
          .find({ deviceId })
          .sort({ timestamp: -1 })
          .limit(maxLogEntriesPerDevice)
          .toArray();
      },
      async append(entry) {
        await logCollection.insertOne(entry);
      },
      async reset() {
        await logCollection.deleteMany({});
      }
    }
  };
}
