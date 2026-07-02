import type { SceneRecord } from "@jenix/shared";

import type { SceneAuditEntry } from "./scene.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const sceneStore = new Map<string, SceneRecord>();
const sceneAuditStore = new Map<string, SceneAuditEntry[]>();

export const sceneRepository = {
  get(sceneId: string): SceneRecord | undefined {
    const record = sceneStore.get(sceneId);
    return record ? clone(record) : undefined;
  },
  list(): SceneRecord[] {
    return Array.from(sceneStore.values()).map(clone);
  },
  save(record: SceneRecord): SceneRecord {
    sceneStore.set(record.sceneId, clone(record));
    return clone(record);
  },
  reset() {
    sceneStore.clear();
  }
};

export const sceneAuditRepository = {
  list(sceneId: string): SceneAuditEntry[] {
    return clone(sceneAuditStore.get(sceneId) ?? []);
  },
  append(entry: SceneAuditEntry) {
    const nextEntries = [...sceneAuditRepository.list(entry.sceneId), clone(entry)];
    sceneAuditStore.set(entry.sceneId, nextEntries);
  },
  reset() {
    sceneAuditStore.clear();
  }
};
