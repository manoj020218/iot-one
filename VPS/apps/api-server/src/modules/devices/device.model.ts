import type { DeviceRecord } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface DeviceRepository {
  list(): Promise<DeviceRecord[]>;
  get(deviceId: string): Promise<DeviceRecord | undefined>;
  save(record: DeviceRecord): Promise<DeviceRecord>;
  reset(): Promise<void>;
}

function createInMemoryDeviceRepository(): DeviceRepository {
  const deviceStore = new Map<string, DeviceRecord>();

  return {
    async list() {
      return Array.from(deviceStore.values(), (device) => clone(device));
    },
    async get(deviceId) {
      const record = deviceStore.get(deviceId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      deviceStore.set(record.deviceId, clone(record));
      return clone(record);
    },
    async reset() {
      deviceStore.clear();
    }
  };
}

let activeDeviceRepository: DeviceRepository = createInMemoryDeviceRepository();

export function useDeviceRepository(repository: DeviceRepository) {
  activeDeviceRepository = repository;
}

export function resetDeviceRepository() {
  activeDeviceRepository = createInMemoryDeviceRepository();
}

export const deviceRepository: DeviceRepository = {
  list() {
    return activeDeviceRepository.list();
  },
  get(deviceId) {
    return activeDeviceRepository.get(deviceId);
  },
  save(record) {
    return activeDeviceRepository.save(record);
  },
  reset() {
    return activeDeviceRepository.reset();
  }
};
