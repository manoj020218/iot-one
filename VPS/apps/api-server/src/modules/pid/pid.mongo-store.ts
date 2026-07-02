import type { Db } from "mongodb";

import type { ProductPidRecord } from "@jenix/device-schemas";

import type { PidPersistenceStore } from "./pid.model";
import type { PidAuditLogRecord } from "./pid.types";

const pidCollectionName = "product_pids";
const pidAuditCollectionName = "pid_audit_logs";

export async function createMongoPidPersistenceStore(
  database: Db
): Promise<PidPersistenceStore> {
  const pidCollection = database.collection<ProductPidRecord>(pidCollectionName);
  const pidAuditCollection =
    database.collection<PidAuditLogRecord>(pidAuditCollectionName);

  await Promise.all([
    pidCollection.createIndex({ pid: 1 }, { unique: true }),
    pidCollection.createIndex({ status: 1, productLine: 1 }),
    pidCollection.createIndex({ productCategory: 1, status: 1 }),
    pidAuditCollection.createIndex({ pid: 1, occurredAt: -1 })
  ]);

  return {
    pids: {
      async list() {
        return pidCollection.find({}).toArray();
      },
      async get(pid) {
        return (await pidCollection.findOne({ pid })) ?? undefined;
      },
      async save(record) {
        await pidCollection.replaceOne(
          { pid: record.pid },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await pidCollection.deleteMany({});
      }
    },
    audits: {
      async append(entry) {
        await pidAuditCollection.insertOne(entry);
      },
      async list(pid) {
        return pidAuditCollection
          .find(pid ? { pid } : {})
          .sort({ occurredAt: 1 })
          .toArray();
      },
      async reset() {
        await pidAuditCollection.deleteMany({});
      }
    }
  };
}
