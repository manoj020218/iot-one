import type { SceneRecord } from "@jenix/shared";

import type { SceneAuditEntry, SceneRunHistoryEntry } from "./scene.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface SceneRepository {
  get(sceneId: string): Promise<SceneRecord | undefined>;
  list(): Promise<SceneRecord[]>;
  save(record: SceneRecord): Promise<SceneRecord>;
  reset(): Promise<void>;
}

export interface SceneAuditRepository {
  list(sceneId: string): Promise<SceneAuditEntry[]>;
  append(entry: SceneAuditEntry): Promise<void>;
  reset(): Promise<void>;
}

export interface SceneRunHistoryRepository {
  list(sceneId: string): Promise<SceneRunHistoryEntry[]>;
  append(entry: SceneRunHistoryEntry): Promise<boolean>;
  reset(): Promise<void>;
}

export interface ScenePersistenceStore {
  scenes: SceneRepository;
  audits: SceneAuditRepository;
  runHistory: SceneRunHistoryRepository;
}

function createInMemoryScenePersistenceStore(): ScenePersistenceStore {
  const sceneStore = new Map<string, SceneRecord>();
  const sceneAuditStore = new Map<string, SceneAuditEntry[]>();
  const sceneRunHistoryStore = new Map<string, SceneRunHistoryEntry[]>();

  const scenes: SceneRepository = {
    async get(sceneId: string) {
      const record = sceneStore.get(sceneId);
      return record ? clone(record) : undefined;
    },
    async list() {
      return Array.from(sceneStore.values()).map(clone);
    },
    async save(record: SceneRecord) {
      sceneStore.set(record.sceneId, clone(record));
      return clone(record);
    },
    async reset() {
      sceneStore.clear();
    }
  };

  const audits: SceneAuditRepository = {
    async list(sceneId: string) {
      return clone(sceneAuditStore.get(sceneId) ?? []);
    },
    async append(entry: SceneAuditEntry) {
      const nextEntries = [...(await audits.list(entry.sceneId)), clone(entry)];
      sceneAuditStore.set(entry.sceneId, nextEntries);
    },
    async reset() {
      sceneAuditStore.clear();
    }
  };

  const runHistory: SceneRunHistoryRepository = {
    async list(sceneId: string) {
      return clone(sceneRunHistoryStore.get(sceneId) ?? []);
    },
    async append(entry: SceneRunHistoryEntry) {
      const existing = await runHistory.list(entry.sceneId);
      const hasDuplicateScheduleEntry =
        entry.source === "schedule" &&
        entry.dedupeKey !== undefined &&
        existing.some(
          (current) =>
            current.source === "schedule" && current.dedupeKey === entry.dedupeKey
        );

      if (hasDuplicateScheduleEntry) {
        return false;
      }

      sceneRunHistoryStore.set(entry.sceneId, [...existing, clone(entry)]);
      return true;
    },
    async reset() {
      sceneRunHistoryStore.clear();
    }
  };

  return {
    scenes,
    audits,
    runHistory
  };
}

let activeScenePersistenceStore: ScenePersistenceStore =
  createInMemoryScenePersistenceStore();

export function useScenePersistenceStore(store: ScenePersistenceStore) {
  activeScenePersistenceStore = store;
}

export function resetScenePersistenceStore() {
  activeScenePersistenceStore = createInMemoryScenePersistenceStore();
}

export const sceneRepository: SceneRepository = {
  get(sceneId) {
    return activeScenePersistenceStore.scenes.get(sceneId);
  },
  list() {
    return activeScenePersistenceStore.scenes.list();
  },
  save(record) {
    return activeScenePersistenceStore.scenes.save(record);
  },
  reset() {
    return activeScenePersistenceStore.scenes.reset();
  }
};

export const sceneAuditRepository: SceneAuditRepository = {
  list(sceneId) {
    return activeScenePersistenceStore.audits.list(sceneId);
  },
  append(entry) {
    return activeScenePersistenceStore.audits.append(entry);
  },
  reset() {
    return activeScenePersistenceStore.audits.reset();
  }
};

export const sceneRunHistoryRepository: SceneRunHistoryRepository = {
  list(sceneId) {
    return activeScenePersistenceStore.runHistory.list(sceneId);
  },
  append(entry) {
    return activeScenePersistenceStore.runHistory.append(entry);
  },
  reset() {
    return activeScenePersistenceStore.runHistory.reset();
  }
};
