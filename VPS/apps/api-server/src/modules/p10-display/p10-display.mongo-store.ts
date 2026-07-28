import type { Db } from "mongodb";

import type { P10DisplayPersistenceStore } from "./p10-display.model";
import type { P10DisplayLogRecord } from "./p10-display.types";

const logCollectionName = "p10_display_logs";
const maxLogEntriesPerDevice = 200;

export async function createMongoP10DisplayPersistenceStore(
  database: Db
): Promise<P10DisplayPersistenceStore> {
  const logCollection = database.collection<P10DisplayLogRecord>(logCollectionName);

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
