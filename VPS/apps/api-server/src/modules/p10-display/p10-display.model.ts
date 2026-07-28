import type { P10DisplayLogRecord } from "./p10-display.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const maxLogEntriesPerDevice = 200;

export interface P10DisplayLogRepository {
  listByDevice(deviceId: string): Promise<P10DisplayLogRecord[]>;
  append(entry: P10DisplayLogRecord): Promise<void>;
  reset(): Promise<void>;
}

export interface P10DisplayPersistenceStore {
  logs: P10DisplayLogRepository;
}

function createInMemoryP10DisplayPersistenceStore(): P10DisplayPersistenceStore {
  const logStore = new Map<string, P10DisplayLogRecord[]>();

  const logs: P10DisplayLogRepository = {
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

let activeP10DisplayPersistenceStore: P10DisplayPersistenceStore =
  createInMemoryP10DisplayPersistenceStore();

export function useP10DisplayPersistenceStore(store: P10DisplayPersistenceStore) {
  activeP10DisplayPersistenceStore = store;
}

export function resetP10DisplayPersistenceStore() {
  activeP10DisplayPersistenceStore = createInMemoryP10DisplayPersistenceStore();
}

export const p10DisplayLogRepository: P10DisplayLogRepository = {
  listByDevice(deviceId) {
    return activeP10DisplayPersistenceStore.logs.listByDevice(deviceId);
  },
  append(entry) {
    return activeP10DisplayPersistenceStore.logs.append(entry);
  },
  reset() {
    return activeP10DisplayPersistenceStore.logs.reset();
  }
};
