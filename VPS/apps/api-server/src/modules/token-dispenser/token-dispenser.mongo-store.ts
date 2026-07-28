import type { Db } from "mongodb";

import type { TokenDispenserPersistenceStore } from "./token-dispenser.model";
import type {
  TokenDispenserConnectionConfig,
  TokenDispenserLogRecord,
  TokenDispenserPrintTemplate
} from "./token-dispenser.types";

const templateCollectionName = "token_dispenser_templates";
const connectionCollectionName = "token_dispenser_connections";
const logCollectionName = "token_dispenser_logs";
const maxLogEntriesPerDevice = 200;

interface TemplateDocument {
  deviceId: string;
  template: TokenDispenserPrintTemplate;
}

export async function createMongoTokenDispenserPersistenceStore(
  database: Db
): Promise<TokenDispenserPersistenceStore> {
  const templateCollection = database.collection<TemplateDocument>(templateCollectionName);
  const connectionCollection = database.collection<TokenDispenserConnectionConfig>(
    connectionCollectionName
  );
  const logCollection = database.collection<TokenDispenserLogRecord>(logCollectionName);

  await Promise.all([
    templateCollection.createIndex({ deviceId: 1 }, { unique: true }),
    connectionCollection.createIndex({ deviceId: 1 }, { unique: true }),
    logCollection.createIndex({ deviceId: 1, timestamp: -1 })
  ]);

  return {
    templates: {
      async get(deviceId) {
        const doc = await templateCollection.findOne({ deviceId });
        return doc?.template;
      },
      async save(deviceId, template) {
        await templateCollection.replaceOne(
          { deviceId },
          { deviceId, template },
          { upsert: true }
        );
      },
      async reset() {
        await templateCollection.deleteMany({});
      }
    },
    connections: {
      async get(deviceId) {
        return (await connectionCollection.findOne({ deviceId })) ?? undefined;
      },
      async save(record) {
        await connectionCollection.replaceOne(
          { deviceId: record.deviceId },
          record,
          { upsert: true }
        );
      },
      async reset() {
        await connectionCollection.deleteMany({});
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
