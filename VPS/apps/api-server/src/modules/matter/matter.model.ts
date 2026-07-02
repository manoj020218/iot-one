import type { MatterRuntimeRecord } from "./matter.types";

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

const runtimeState = new Map<string, MatterRuntimeRecord>();

export const matterRuntimeRepository = {
  get(deviceId: string): MatterRuntimeRecord | undefined {
    return runtimeState.get(normalizeDeviceId(deviceId));
  },
  save(record: MatterRuntimeRecord): MatterRuntimeRecord {
    runtimeState.set(normalizeDeviceId(record.deviceId), structuredClone(record));
    return structuredClone(record);
  },
  reset() {
    runtimeState.clear();
  }
};
