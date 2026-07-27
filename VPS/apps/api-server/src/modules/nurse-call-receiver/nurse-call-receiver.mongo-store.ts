import type { Db } from "mongodb";

import type { NurseCallReceiverPersistenceStore } from "./nurse-call-receiver.model";
import type { NurseCallRecord, NurseCallRemoteRecord } from "./nurse-call-receiver.types";

const remoteCollectionName = "nurse_call_remotes";
const callCollectionName = "nurse_call_records";

export async function createMongoNurseCallReceiverPersistenceStore(
  database: Db
): Promise<NurseCallReceiverPersistenceStore> {
  const remoteCollection =
    database.collection<NurseCallRemoteRecord>(remoteCollectionName);
  const callCollection = database.collection<NurseCallRecord>(callCollectionName);

  await Promise.all([
    remoteCollection.createIndex({ remoteId: 1 }, { unique: true }),
    remoteCollection.createIndex({ deviceId: 1 }),
    callCollection.createIndex({ callId: 1 }, { unique: true }),
    callCollection.createIndex({ deviceId: 1, status: 1, raisedAt: -1 })
  ]);

  return {
    remotes: {
      async listByDevice(deviceId) {
        return remoteCollection.find({ deviceId }).toArray();
      },
      async save(record) {
        await remoteCollection.replaceOne({ remoteId: record.remoteId }, record, {
          upsert: true
        });
        return record;
      },
      async reset() {
        await remoteCollection.deleteMany({});
      }
    },
    calls: {
      async listByDevice(deviceId, status) {
        return callCollection
          .find(status ? { deviceId, status } : { deviceId })
          .sort({ raisedAt: -1 })
          .toArray();
      },
      async get(callId) {
        return (await callCollection.findOne({ callId })) ?? undefined;
      },
      async save(record) {
        await callCollection.replaceOne({ callId: record.callId }, record, {
          upsert: true
        });
        return record;
      },
      async reset() {
        await callCollection.deleteMany({});
      }
    }
  };
}
