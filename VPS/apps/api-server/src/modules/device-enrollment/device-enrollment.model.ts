import type { Collection } from "mongodb";

import { getMongoDb } from "../../infrastructure/mongo";

const COLLECTION_NAME = "device_credentials";

export interface DeviceCredentialDocument {
  deviceId: string;
  mqttUsername: string;
  mqttPassword: string;
  issuedAt: string;
}

// Deliberately its own store, not a field on DeviceRecord (device.ts) --
// DeviceRecord is returned wholesale to authenticated app users elsewhere
// (getDeviceController etc.), so a live MQTT password has no business living
// on that type.
//
// In-memory by default (like device.model.ts's own DeviceRepository),
// upgrading to Mongo when MONGODB_URI is configured -- unlike
// factory-record.service.ts's "throw if unconfigured" version of this same
// lazy pattern, this one must never throw on a save: it's called from the
// device-facing enrollment endpoint, and a dev/test environment with no
// MONGODB_URI set should still be able to issue and reuse a credential.
const memoryStore = new Map<string, DeviceCredentialDocument>();

let collectionPromise: Promise<Collection<DeviceCredentialDocument>> | undefined;

function getCollection(): Promise<Collection<DeviceCredentialDocument>> | undefined {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    return undefined;
  }

  if (!collectionPromise) {
    collectionPromise = getMongoDb(uri).then(async (db) => {
      const collection = db.collection<DeviceCredentialDocument>(COLLECTION_NAME);
      await collection.createIndex({ deviceId: 1 }, { unique: true });
      return collection;
    });
  }

  return collectionPromise;
}

export async function getDeviceCredential(
  deviceId: string
): Promise<DeviceCredentialDocument | undefined> {
  const collection = await getCollection();
  if (!collection) {
    return memoryStore.get(deviceId);
  }

  return (await collection.findOne({ deviceId })) ?? undefined;
}

export async function saveDeviceCredential(record: DeviceCredentialDocument): Promise<void> {
  const collection = await getCollection();
  if (!collection) {
    memoryStore.set(record.deviceId, record);
    return;
  }

  await collection.replaceOne({ deviceId: record.deviceId }, record, { upsert: true });
}

export function resetDeviceCredentialStore(): void {
  memoryStore.clear();
}
