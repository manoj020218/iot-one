import type { OtaReleaseRecord } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const otaReleaseStore = new Map<string, OtaReleaseRecord>();

export const otaRepository = {
  list(): OtaReleaseRecord[] {
    return Array.from(otaReleaseStore.values(), (record) => clone(record));
  },

  get(releaseId: string): OtaReleaseRecord | undefined {
    const record = otaReleaseStore.get(releaseId);
    return record ? clone(record) : undefined;
  },

  save(record: OtaReleaseRecord): OtaReleaseRecord {
    otaReleaseStore.set(record.releaseId, clone(record));
    return clone(record);
  },

  reset() {
    otaReleaseStore.clear();
  }
};
