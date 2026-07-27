import type { UiPackageRecord } from "@jenix/shared";

import type { UiPackageAuditLogRecord, UiPackageModuleState } from "./ui-package.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface UiPackageRepository {
  list(): Promise<UiPackageRecord[]>;
  get(packageId: string): Promise<UiPackageRecord | undefined>;
  save(record: UiPackageRecord): Promise<UiPackageRecord>;
  reset(): Promise<void>;
}

export interface UiPackageAuditRepository {
  append(entry: UiPackageAuditLogRecord): Promise<void>;
  list(packageId?: string): Promise<UiPackageAuditLogRecord[]>;
  reset(): Promise<void>;
}

export interface UiPackagePersistenceStore {
  packages: UiPackageRepository;
  audits: UiPackageAuditRepository;
}

// Preserves current runtime behavior: this is the one package the platform
// serves today (see DEVICE_PACKAGE_RUNTIME.md), now living in the registry
// instead of a hardcoded catalog Map.
const seedTimestamp = "2026-07-09T00:00:00.000Z";

function createSeedPackages(): UiPackageRecord[] {
  return [
    {
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
    }
  ];
}

function createInMemoryUiPackagePersistenceStore(): UiPackagePersistenceStore {
  const packageStore = new Map<string, UiPackageRecord>(
    createSeedPackages().map((record) => [record.packageId, record])
  );
  const auditLogStore: UiPackageAuditLogRecord[] = [];

  const packages: UiPackageRepository = {
    async list() {
      return Array.from(packageStore.values(), (record) => clone(record));
    },
    async get(packageId) {
      const record = packageStore.get(packageId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      packageStore.set(record.packageId, clone(record));
      return clone(record);
    },
    async reset() {
      packageStore.clear();
      for (const record of createSeedPackages()) {
        packageStore.set(record.packageId, record);
      }
    }
  };

  const audits: UiPackageAuditRepository = {
    async append(entry) {
      auditLogStore.push(clone(entry));
    },
    async list(packageId) {
      const entries = packageId
        ? auditLogStore.filter((entry) => entry.packageId === packageId)
        : auditLogStore;

      return clone(entries);
    },
    async reset() {
      auditLogStore.length = 0;
    }
  };

  return {
    packages,
    audits
  };
}

let activeUiPackagePersistenceStore: UiPackagePersistenceStore =
  createInMemoryUiPackagePersistenceStore();

export function useUiPackagePersistenceStore(store: UiPackagePersistenceStore) {
  activeUiPackagePersistenceStore = store;
}

export function resetUiPackagePersistenceStore() {
  activeUiPackagePersistenceStore = createInMemoryUiPackagePersistenceStore();
}

export const uiPackageRepository: UiPackageRepository = {
  list() {
    return activeUiPackagePersistenceStore.packages.list();
  },
  get(packageId) {
    return activeUiPackagePersistenceStore.packages.get(packageId);
  },
  save(record) {
    return activeUiPackagePersistenceStore.packages.save(record);
  },
  reset() {
    return activeUiPackagePersistenceStore.packages.reset();
  }
};

export const uiPackageAuditRepository: UiPackageAuditRepository = {
  append(entry) {
    return activeUiPackagePersistenceStore.audits.append(entry);
  },
  list(packageId) {
    return activeUiPackagePersistenceStore.audits.list(packageId);
  },
  reset() {
    return activeUiPackagePersistenceStore.audits.reset();
  }
};

export async function snapshotUiPackagePersistenceState(): Promise<UiPackageModuleState> {
  return {
    packages: await uiPackageRepository.list(),
    auditLogs: await uiPackageAuditRepository.list()
  };
}
