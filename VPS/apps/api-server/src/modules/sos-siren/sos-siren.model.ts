import type { SosSirenLogRecord } from "./sos-siren.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const maxLogEntriesPerDevice = 200;

export interface SosSirenLogRepository {
  listByDevice(deviceId: string): Promise<SosSirenLogRecord[]>;
  append(entry: SosSirenLogRecord): Promise<void>;
  reset(): Promise<void>;
}

export interface SosSirenPersistenceStore {
  logs: SosSirenLogRepository;
}

function createInMemorySosSirenPersistenceStore(): SosSirenPersistenceStore {
  const logStore = new Map<string, SosSirenLogRecord[]>();

  const logs: SosSirenLogRepository = {
    async listByDevice(deviceId) {
      return clone(logStore.get(deviceId) ?? []);
    },
    async append(entry) {
      const list = logStore.get(entry.deviceId) ?? [];
      list.unshift(clone(entry));
      logStore.set(entry.deviceId, list.slice(0, maxLogEntriesPerDevice));
    },
    async reset() {
      logStore.clear();
    }
  };

  return { logs };
}

let activeSosSirenPersistenceStore: SosSirenPersistenceStore =
  createInMemorySosSirenPersistenceStore();

export function useSosSirenPersistenceStore(store: SosSirenPersistenceStore) {
  activeSosSirenPersistenceStore = store;
}

export function resetSosSirenPersistenceStore() {
  activeSosSirenPersistenceStore = createInMemorySosSirenPersistenceStore();
}

export const sosSirenLogRepository: SosSirenLogRepository = {
  listByDevice(deviceId) {
    return activeSosSirenPersistenceStore.logs.listByDevice(deviceId);
  },
  append(entry) {
    return activeSosSirenPersistenceStore.logs.append(entry);
  },
  reset() {
    return activeSosSirenPersistenceStore.logs.reset();
  }
};
