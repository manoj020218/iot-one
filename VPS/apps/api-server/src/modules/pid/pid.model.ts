import type { ProductPidRecord } from "@jenix/device-schemas";

import type { PidAuditLogRecord, PidModuleState } from "./pid.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface PidRepository {
  list(): Promise<ProductPidRecord[]>;
  get(pid: string): Promise<ProductPidRecord | undefined>;
  save(record: ProductPidRecord): Promise<ProductPidRecord>;
  reset(): Promise<void>;
}

export interface PidAuditRepository {
  append(entry: PidAuditLogRecord): Promise<void>;
  list(pid?: string): Promise<PidAuditLogRecord[]>;
  reset(): Promise<void>;
}

export interface PidPersistenceStore {
  pids: PidRepository;
  audits: PidAuditRepository;
}

function createInMemoryPidPersistenceStore(): PidPersistenceStore {
  const pidStore = new Map<string, ProductPidRecord>();
  const pidAuditLogStore: PidAuditLogRecord[] = [];

  const pids: PidRepository = {
    async list() {
      return Array.from(pidStore.values(), (pid) => clone(pid));
    },
    async get(pid) {
      const record = pidStore.get(pid);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      pidStore.set(record.pid, clone(record));
      return clone(record);
    },
    async reset() {
      pidStore.clear();
    }
  };

  const audits: PidAuditRepository = {
    async append(entry) {
      pidAuditLogStore.push(clone(entry));
    },
    async list(pid) {
      const entries = pid
        ? pidAuditLogStore.filter((entry) => entry.pid === pid)
        : pidAuditLogStore;

      return clone(entries);
    },
    async reset() {
      pidAuditLogStore.length = 0;
    }
  };

  return {
    pids,
    audits
  };
}

let activePidPersistenceStore: PidPersistenceStore =
  createInMemoryPidPersistenceStore();

export function usePidPersistenceStore(store: PidPersistenceStore) {
  activePidPersistenceStore = store;
}

export function resetPidPersistenceStore() {
  activePidPersistenceStore = createInMemoryPidPersistenceStore();
}

export const pidRepository: PidRepository = {
  list() {
    return activePidPersistenceStore.pids.list();
  },
  get(pid) {
    return activePidPersistenceStore.pids.get(pid);
  },
  save(record) {
    return activePidPersistenceStore.pids.save(record);
  },
  reset() {
    return activePidPersistenceStore.pids.reset();
  }
};

export const pidAuditRepository: PidAuditRepository = {
  append(entry) {
    return activePidPersistenceStore.audits.append(entry);
  },
  list(pid) {
    return activePidPersistenceStore.audits.list(pid);
  },
  reset() {
    return activePidPersistenceStore.audits.reset();
  }
};

export async function snapshotPidPersistenceState(): Promise<PidModuleState> {
  return {
    pids: await pidRepository.list(),
    auditLogs: await pidAuditRepository.list()
  };
}
