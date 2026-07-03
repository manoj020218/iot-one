import type { ProvisioningIntentRecord } from "./provisioning.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface ProvisioningRepository {
  get(provisioningId: string): Promise<ProvisioningIntentRecord | undefined>;
  save(record: ProvisioningIntentRecord): Promise<ProvisioningIntentRecord>;
  reset(): Promise<void>;
}

function createInMemoryProvisioningRepository(): ProvisioningRepository {
  const provisioningStore = new Map<string, ProvisioningIntentRecord>();

  return {
    async get(provisioningId) {
      const record = provisioningStore.get(provisioningId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      provisioningStore.set(record.provisioningId, clone(record));
      return clone(record);
    },
    async reset() {
      provisioningStore.clear();
    }
  };
}

let activeProvisioningRepository = createInMemoryProvisioningRepository();

export function useProvisioningRepository(repository: ProvisioningRepository) {
  activeProvisioningRepository = repository;
}

export function resetProvisioningRepository() {
  activeProvisioningRepository = createInMemoryProvisioningRepository();
}

export const provisioningRepository: ProvisioningRepository = {
  get(provisioningId) {
    return activeProvisioningRepository.get(provisioningId);
  },
  save(record) {
    return activeProvisioningRepository.save(record);
  },
  reset() {
    return activeProvisioningRepository.reset();
  }
};
