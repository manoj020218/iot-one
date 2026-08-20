import type { LockStateRecord } from "./lock.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface LockRepository {
  getState(deviceId: string): Promise<LockStateRecord | undefined>;
  recordDispatch(deviceId: string, dispatchedAt: string, reason: string | null): Promise<void>;
  // requestId -> the UnlockResult it produced, for idempotent retries
  // (same convention as sessionRepository.getByRequestId in Smart Streamer).
  getByRequestId(requestId: string): Promise<LockStateRecord | undefined>;
  saveRequestId(requestId: string, deviceId: string): Promise<void>;
  reset(): Promise<void>;
}

function createInMemoryLockRepository(): LockRepository {
  const store = new Map<string, LockStateRecord>();
  const requestIndex = new Map<string, string>();

  return {
    async getState(deviceId) {
      const record = store.get(deviceId);
      return record ? clone(record) : undefined;
    },
    async recordDispatch(deviceId, dispatchedAt, reason) {
      store.set(deviceId, { deviceId, lastDispatchedAt: dispatchedAt, lastReason: reason });
    },
    async getByRequestId(requestId) {
      const deviceId = requestIndex.get(requestId);
      if (!deviceId) {
        return undefined;
      }
      const record = store.get(deviceId);
      return record ? clone(record) : undefined;
    },
    async saveRequestId(requestId, deviceId) {
      requestIndex.set(requestId, deviceId);
    },
    async reset() {
      store.clear();
      requestIndex.clear();
    }
  };
}

export const lockRepository: LockRepository = createInMemoryLockRepository();

export async function resetLockStore(): Promise<void> {
  await lockRepository.reset();
}
