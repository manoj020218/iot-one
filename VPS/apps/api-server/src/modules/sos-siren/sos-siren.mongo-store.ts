import type { Db } from "mongodb";

import type { SosSirenPersistenceStore } from "./sos-siren.model";
import type { SosSirenLogRecord } from "./sos-siren.types";

const logCollectionName = "sos_siren_logs";
const maxLogEntriesPerDevice = 200;

export async function createMongoSosSirenPersistenceStore(
  database: Db
): Promise<SosSirenPersistenceStore> {
  const logCollection = database.collection<SosSirenLogRecord>(logCollectionName);

  await logCollection.createIndex({ deviceId: 1, timestamp: -1 });

  return {
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
