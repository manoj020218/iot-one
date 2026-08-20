import { randomUUID } from "node:crypto";

import type { RfRemoteRecord } from "./rf-remote.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface RfRemoteRepository {
  list(deviceId: string): Promise<RfRemoteRecord[]>;
  add(deviceId: string, name: string): Promise<RfRemoteRecord>;
  rename(deviceId: string, remoteId: string, name: string): Promise<RfRemoteRecord | undefined>;
  remove(deviceId: string, remoteId: string): Promise<boolean>;
  reset(): Promise<void>;
}

function createInMemoryRfRemoteRepository(): RfRemoteRepository {
  const store = new Map<string, RfRemoteRecord[]>();

  return {
    async list(deviceId) {
      return clone(store.get(deviceId) ?? []);
    },
    async add(deviceId, name) {
      const existing = store.get(deviceId) ?? [];
      const record: RfRemoteRecord = {
        remoteId: randomUUID(),
        deviceId,
        name,
        pairedAt: new Date().toISOString()
      };
      store.set(deviceId, [...existing, record]);
      return clone(record);
    },
    async rename(deviceId, remoteId, name) {
      const existing = store.get(deviceId) ?? [];
      const index = existing.findIndex((remote) => remote.remoteId === remoteId);
      if (index === -1) {
        return undefined;
      }
      const updated = { ...existing[index], name } as RfRemoteRecord;
      const next = [...existing];
      next[index] = updated;
      store.set(deviceId, next);
      return clone(updated);
    },
    async remove(deviceId, remoteId) {
      const existing = store.get(deviceId) ?? [];
      const next = existing.filter((remote) => remote.remoteId !== remoteId);
      store.set(deviceId, next);
      return next.length !== existing.length;
    },
    async reset() {
      store.clear();
    }
  };
}

export const rfRemoteRepository: RfRemoteRepository = createInMemoryRfRemoteRepository();

export async function resetRfRemoteStore(): Promise<void> {
  await rfRemoteRepository.reset();
}
