import type { SpeakerAudioAssetRecord } from "./audio-asset.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface AudioAssetRepository {
  listByHome(homeId: string): Promise<SpeakerAudioAssetRecord[]>;
  get(audioId: string): Promise<SpeakerAudioAssetRecord | undefined>;
  save(record: SpeakerAudioAssetRecord): Promise<SpeakerAudioAssetRecord>;
  reset(): Promise<void>;
}

function createInMemoryAudioAssetRepository(): AudioAssetRepository {
  const store = new Map<string, SpeakerAudioAssetRecord>();

  return {
    async listByHome(homeId) {
      return Array.from(store.values(), clone).filter((record) => record.homeId === homeId);
    },
    async get(audioId) {
      const record = store.get(audioId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      store.set(record.audioId, clone(record));
      return clone(record);
    },
    async reset() {
      store.clear();
    }
  };
}

export const audioAssetRepository = createInMemoryAudioAssetRepository();
