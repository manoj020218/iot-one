import type { RfLearnStateRecord } from "./rf-learning.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface RfLearningRepository {
  getState(deviceId: string): Promise<RfLearnStateRecord | undefined>;
  save(record: RfLearnStateRecord): Promise<RfLearnStateRecord>;
  reset(): Promise<void>;
}

function createInMemoryRfLearningRepository(): RfLearningRepository {
  const store = new Map<string, RfLearnStateRecord>();

  return {
    async getState(deviceId) {
      const record = store.get(deviceId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      store.set(record.deviceId, clone(record));
      return clone(record);
    },
    async reset() {
      store.clear();
    }
  };
}

export const rfLearningRepository: RfLearningRepository = createInMemoryRfLearningRepository();

export async function resetRfLearningStore(): Promise<void> {
  await rfLearningRepository.reset();
}
