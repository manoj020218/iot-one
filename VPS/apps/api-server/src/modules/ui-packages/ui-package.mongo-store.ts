import type { Db } from "mongodb";

import type { UiPackageRecord } from "@jenix/shared";

import type { UiPackagePersistenceStore } from "./ui-package.model";
import type { UiPackageAuditLogRecord } from "./ui-package.types";

const uiPackageCollectionName = "ui_packages";
const uiPackageAuditCollectionName = "ui_package_audit_logs";

const seedTimestamp = "2026-07-09T00:00:00.000Z";

function createSeedRecord(): UiPackageRecord {
  return {
    packageId: "tank-guard-mobile",
    pid: "JNX-TG-C3-001",
    displayName: "Tank Guard remote UI",
    versions: [
      {
        version: "1.0.0",
        manifestPath: "/ui-packages/tank-guard-mobile/1.0.0/manifest.json",
        entryPath: "/ui-packages/tank-guard-mobile/1.0.0/remoteEntry.js",
        exportName: "TankGuardDynamicPage",
        status: "published",
        createdAt: seedTimestamp,
        createdBy: "system-seed",
        publishedAt: seedTimestamp,
        publishedBy: "system-seed"
      }
    ],
    createdAt: seedTimestamp,
    createdBy: "system-seed",
    updatedAt: seedTimestamp
  };
}

export async function createMongoUiPackagePersistenceStore(
  database: Db
): Promise<UiPackagePersistenceStore> {
  const uiPackageCollection =
    database.collection<UiPackageRecord>(uiPackageCollectionName);
  const uiPackageAuditCollection = database.collection<UiPackageAuditLogRecord>(
    uiPackageAuditCollectionName
  );

  await Promise.all([
    uiPackageCollection.createIndex({ packageId: 1 }, { unique: true }),
    uiPackageCollection.createIndex({ pid: 1 }),
    uiPackageAuditCollection.createIndex({ packageId: 1, occurredAt: -1 })
  ]);

  // First-run migration only: keeps the one package the platform already
  // serves in production working after switching off the hardcoded catalog.
  const seed = createSeedRecord();
  await uiPackageCollection.updateOne(
    { packageId: seed.packageId },
    { $setOnInsert: seed },
    { upsert: true }
  );

  return {
    packages: {
      async list() {
        return uiPackageCollection.find({}).toArray();
      },
      async get(packageId) {
        return (await uiPackageCollection.findOne({ packageId })) ?? undefined;
      },
      async save(record) {
        await uiPackageCollection.replaceOne(
          { packageId: record.packageId },
          record,
          { upsert: true }
        );

        return record;
      },
      async reset() {
        await uiPackageCollection.deleteMany({});
      }
    },
    audits: {
      async append(entry) {
        await uiPackageAuditCollection.insertOne(entry);
      },
      async list(packageId) {
        return uiPackageAuditCollection
          .find(packageId ? { packageId } : {})
          .sort({ occurredAt: 1 })
          .toArray();
      },
      async reset() {
        await uiPackageAuditCollection.deleteMany({});
      }
    }
  };
}
