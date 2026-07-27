import type { NurseCallRecord, NurseCallRemoteRecord } from "./nurse-call-receiver.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface NurseCallRemoteRepository {
  listByDevice(deviceId: string): Promise<NurseCallRemoteRecord[]>;
  save(record: NurseCallRemoteRecord): Promise<NurseCallRemoteRecord>;
  reset(): Promise<void>;
}

export interface NurseCallRecordRepository {
  listByDevice(deviceId: string, status?: NurseCallRecord["status"]): Promise<NurseCallRecord[]>;
  get(callId: string): Promise<NurseCallRecord | undefined>;
  save(record: NurseCallRecord): Promise<NurseCallRecord>;
  reset(): Promise<void>;
}

export interface NurseCallReceiverPersistenceStore {
  remotes: NurseCallRemoteRepository;
  calls: NurseCallRecordRepository;
}

function createInMemoryNurseCallReceiverPersistenceStore(): NurseCallReceiverPersistenceStore {
  const remoteStore = new Map<string, NurseCallRemoteRecord>();
  const callStore = new Map<string, NurseCallRecord>();

  const remotes: NurseCallRemoteRepository = {
    async listByDevice(deviceId) {
      return Array.from(remoteStore.values())
        .filter((record) => record.deviceId === deviceId)
        .map((record) => clone(record));
    },
    async save(record) {
      remoteStore.set(record.remoteId, clone(record));
      return clone(record);
    },
    async reset() {
      remoteStore.clear();
    }
  };

  const calls: NurseCallRecordRepository = {
    async listByDevice(deviceId, status) {
      return Array.from(callStore.values())
        .filter(
          (record) => record.deviceId === deviceId && (!status || record.status === status)
        )
        .map((record) => clone(record));
    },
    async get(callId) {
      const record = callStore.get(callId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      callStore.set(record.callId, clone(record));
      return clone(record);
    },
    async reset() {
      callStore.clear();
    }
  };

  return { remotes, calls };
}

let activeNurseCallReceiverPersistenceStore: NurseCallReceiverPersistenceStore =
  createInMemoryNurseCallReceiverPersistenceStore();

export function useNurseCallReceiverPersistenceStore(
  store: NurseCallReceiverPersistenceStore
) {
  activeNurseCallReceiverPersistenceStore = store;
}

export function resetNurseCallReceiverPersistenceStore() {
  activeNurseCallReceiverPersistenceStore = createInMemoryNurseCallReceiverPersistenceStore();
}

export const nurseCallRemoteRepository: NurseCallRemoteRepository = {
  listByDevice(deviceId) {
    return activeNurseCallReceiverPersistenceStore.remotes.listByDevice(deviceId);
  },
  save(record) {
    return activeNurseCallReceiverPersistenceStore.remotes.save(record);
  },
  reset() {
    return activeNurseCallReceiverPersistenceStore.remotes.reset();
  }
};

export const nurseCallRecordRepository: NurseCallRecordRepository = {
  listByDevice(deviceId, status) {
    return activeNurseCallReceiverPersistenceStore.calls.listByDevice(deviceId, status);
  },
  get(callId) {
    return activeNurseCallReceiverPersistenceStore.calls.get(callId);
  },
  save(record) {
    return activeNurseCallReceiverPersistenceStore.calls.save(record);
  },
  reset() {
    return activeNurseCallReceiverPersistenceStore.calls.reset();
  }
};
