import type { DeviceRecord } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const deviceStore = new Map<string, DeviceRecord>();

export const deviceRepository = {
  list(): DeviceRecord[] {
    return Array.from(deviceStore.values(), (device) => clone(device));
  },

  get(deviceId: string): DeviceRecord | undefined {
    const record = deviceStore.get(deviceId);
    return record ? clone(record) : undefined;
  },

  save(record: DeviceRecord): DeviceRecord {
    deviceStore.set(record.deviceId, clone(record));
    return clone(record);
  },

  reset(): void {
    deviceStore.clear();
  }
};
