import type { Collection } from "mongodb";

import { getMongoDb } from "../../infrastructure/mongo";

const COLLECTION_NAME = "factory_records";

export interface FactoryRecordDocument {
  deviceId: string;
  pid: string;
  proofOfPossession: string;
  capturedAt: string;
}

let collectionPromise: Promise<Collection<FactoryRecordDocument>> | undefined;

// Lazy/optional by design: a deployment without MONGODB_URI simply never has
// factory records to serve, and callers (the BLE provisioning read side)
// treat "not found" the same as "lookup unavailable" -- the app falls back
// to asking the installer to type the PoP manually either way.
function getCollection(): Promise<Collection<FactoryRecordDocument>> | undefined {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    return undefined;
  }

  if (!collectionPromise) {
    collectionPromise = getMongoDb(uri).then(async (db) => {
      const collection = db.collection<FactoryRecordDocument>(COLLECTION_NAME);
      await collection.createIndex({ deviceId: 1 }, { unique: true });
      return collection;
    });
  }

  return collectionPromise;
}

export async function saveFactoryRecord(record: FactoryRecordDocument): Promise<void> {
  const collection = await getCollection();
  if (!collection) {
    throw new Error("MONGODB_URI is not configured -- cannot store factory records");
  }

  await collection.replaceOne({ deviceId: record.deviceId }, record, { upsert: true });
}

export async function getFactoryRecordProofOfPossession(
  deviceId: string
): Promise<string | undefined> {
  const collection = await getCollection();
  if (!collection) {
    return undefined;
  }

  const doc = await collection.findOne({ deviceId });
  return doc?.proofOfPossession;
}
