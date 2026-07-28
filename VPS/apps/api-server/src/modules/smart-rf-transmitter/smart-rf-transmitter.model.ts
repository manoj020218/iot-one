import type { SmartRfButtonProfile, SmartRfCommandLogRecord } from "./smart-rf-transmitter.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const maxLogEntriesPerDevice = 300;

export interface SmartRfProfileRepository {
  listByDevice(deviceId: string): Promise<SmartRfButtonProfile[]>;
  get(deviceId: string, profileId: number): Promise<SmartRfButtonProfile | undefined>;
  save(record: SmartRfButtonProfile): Promise<SmartRfButtonProfile>;
  remove(deviceId: string, profileId: number): Promise<void>;
  reset(): Promise<void>;
}

export interface SmartRfLogRepository {
  listByDevice(deviceId: string): Promise<SmartRfCommandLogRecord[]>;
  append(entry: SmartRfCommandLogRecord): Promise<void>;
  reset(): Promise<void>;
}

export interface SmartRfTransmitterPersistenceStore {
  profiles: SmartRfProfileRepository;
  logs: SmartRfLogRepository;
}

function createInMemorySmartRfTransmitterPersistenceStore(): SmartRfTransmitterPersistenceStore {
  const profileStore = new Map<string, SmartRfButtonProfile>();
  const logStore = new Map<string, SmartRfCommandLogRecord[]>();

  function profileKey(deviceId: string, profileId: number): string {
    return `${deviceId}#${profileId}`;
  }

  const profiles: SmartRfProfileRepository = {
    async listByDevice(deviceId) {
      return Array.from(profileStore.values())
        .filter((record) => record.deviceId === deviceId)
        .sort((left, right) => left.profileId - right.profileId)
        .map((record) => clone(record));
    },
    async get(deviceId, profileId) {
      const record = profileStore.get(profileKey(deviceId, profileId));
      return record ? clone(record) : undefined;
    },
    async save(record) {
      profileStore.set(profileKey(record.deviceId, record.profileId), clone(record));
      return clone(record);
    },
    async remove(deviceId, profileId) {
      profileStore.delete(profileKey(deviceId, profileId));
    },
    async reset() {
      profileStore.clear();
    }
  };

  const logs: SmartRfLogRepository = {
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

  return { profiles, logs };
}

let activeSmartRfTransmitterPersistenceStore: SmartRfTransmitterPersistenceStore =
  createInMemorySmartRfTransmitterPersistenceStore();

export function useSmartRfTransmitterPersistenceStore(
  store: SmartRfTransmitterPersistenceStore
) {
  activeSmartRfTransmitterPersistenceStore = store;
}

export function resetSmartRfTransmitterPersistenceStore() {
  activeSmartRfTransmitterPersistenceStore = createInMemorySmartRfTransmitterPersistenceStore();
}

export const smartRfProfileRepository: SmartRfProfileRepository = {
  listByDevice(deviceId) {
    return activeSmartRfTransmitterPersistenceStore.profiles.listByDevice(deviceId);
  },
  get(deviceId, profileId) {
    return activeSmartRfTransmitterPersistenceStore.profiles.get(deviceId, profileId);
  },
  save(record) {
    return activeSmartRfTransmitterPersistenceStore.profiles.save(record);
  },
  remove(deviceId, profileId) {
    return activeSmartRfTransmitterPersistenceStore.profiles.remove(deviceId, profileId);
  },
  reset() {
    return activeSmartRfTransmitterPersistenceStore.profiles.reset();
  }
};

export const smartRfLogRepository: SmartRfLogRepository = {
  listByDevice(deviceId) {
    return activeSmartRfTransmitterPersistenceStore.logs.listByDevice(deviceId);
  },
  append(entry) {
    return activeSmartRfTransmitterPersistenceStore.logs.append(entry);
  },
  reset() {
    return activeSmartRfTransmitterPersistenceStore.logs.reset();
  }
};
