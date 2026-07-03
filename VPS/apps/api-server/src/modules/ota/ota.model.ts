import type { OtaReleaseRecord } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface OtaRepository {
  list(): Promise<OtaReleaseRecord[]>;
  get(releaseId: string): Promise<OtaReleaseRecord | undefined>;
  save(record: OtaReleaseRecord): Promise<OtaReleaseRecord>;
  reset(): Promise<void>;
}

function createInMemoryOtaRepository(): OtaRepository {
  const otaReleaseStore = new Map<string, OtaReleaseRecord>();

  return {
    async list() {
      return Array.from(otaReleaseStore.values(), (record) => clone(record));
    },
    async get(releaseId) {
      const record = otaReleaseStore.get(releaseId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      otaReleaseStore.set(record.releaseId, clone(record));
      return clone(record);
    },
    async reset() {
      otaReleaseStore.clear();
    }
  };
}

let activeOtaRepository = createInMemoryOtaRepository();

export function useOtaRepository(repository: OtaRepository) {
  activeOtaRepository = repository;
}

export function resetOtaRepository() {
  activeOtaRepository = createInMemoryOtaRepository();
}

export const otaRepository: OtaRepository = {
  list() {
    return activeOtaRepository.list();
  },
  get(releaseId) {
    return activeOtaRepository.get(releaseId);
  },
  save(record) {
    return activeOtaRepository.save(record);
  },
  reset() {
    return activeOtaRepository.reset();
  }
};
