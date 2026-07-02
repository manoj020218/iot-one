import type { ProvisioningIntentRecord } from "./provisioning.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const provisioningStore = new Map<string, ProvisioningIntentRecord>();

export const provisioningRepository = {
  get(provisioningId: string): ProvisioningIntentRecord | undefined {
    const record = provisioningStore.get(provisioningId);
    return record ? clone(record) : undefined;
  },
  save(record: ProvisioningIntentRecord): ProvisioningIntentRecord {
    provisioningStore.set(record.provisioningId, clone(record));
    return clone(record);
  },
  reset() {
    provisioningStore.clear();
  }
};
