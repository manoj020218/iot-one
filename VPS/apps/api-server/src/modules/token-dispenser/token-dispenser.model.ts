import type {
  TokenDispenserConnectionConfig,
  TokenDispenserLogRecord,
  TokenDispenserPrintTemplate
} from "./token-dispenser.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const maxLogEntriesPerDevice = 200;

export interface TokenDispenserTemplateRepository {
  get(deviceId: string): Promise<TokenDispenserPrintTemplate | undefined>;
  save(deviceId: string, template: TokenDispenserPrintTemplate): Promise<void>;
  reset(): Promise<void>;
}

/** Kept for Billing Dispenser (same firmware family, still on the old
 *  per-device connection-config topic scheme) — see its own dispatchCommand
 *  in billing-dispenser.service.ts. Token Dispenser itself no longer uses
 *  this; it's on the canonical scheme now. */
export interface TokenDispenserConnectionRepository {
  get(deviceId: string): Promise<TokenDispenserConnectionConfig | undefined>;
  save(record: TokenDispenserConnectionConfig): Promise<void>;
  reset(): Promise<void>;
}

export interface TokenDispenserLogRepository {
  listByDevice(deviceId: string): Promise<TokenDispenserLogRecord[]>;
  append(entry: TokenDispenserLogRecord): Promise<void>;
  reset(): Promise<void>;
}

export interface TokenDispenserPersistenceStore {
  templates: TokenDispenserTemplateRepository;
  connections: TokenDispenserConnectionRepository;
  logs: TokenDispenserLogRepository;
}

function createInMemoryTokenDispenserPersistenceStore(): TokenDispenserPersistenceStore {
  const templateStore = new Map<string, TokenDispenserPrintTemplate>();
  const connectionStore = new Map<string, TokenDispenserConnectionConfig>();
  const logStore = new Map<string, TokenDispenserLogRecord[]>();

  const templates: TokenDispenserTemplateRepository = {
    async get(deviceId) {
      const record = templateStore.get(deviceId);
      return record ? clone(record) : undefined;
    },
    async save(deviceId, template) {
      templateStore.set(deviceId, clone(template));
    },
    async reset() {
      templateStore.clear();
    }
  };

  const connections: TokenDispenserConnectionRepository = {
    async get(deviceId) {
      const record = connectionStore.get(deviceId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      connectionStore.set(record.deviceId, clone(record));
    },
    async reset() {
      connectionStore.clear();
    }
  };

  const logs: TokenDispenserLogRepository = {
    async listByDevice(deviceId) {
      return clone(logStore.get(deviceId) ?? []);
    },
    async append(entry) {
      const list = logStore.get(entry.deviceId) ?? [];
      list.unshift(clone(entry));
      logStore.set(entry.deviceId, list.slice(0, maxLogEntriesPerDevice));
    },
    async reset() {
      logStore.clear();
    }
  };

  return { templates, connections, logs };
}

let activeTokenDispenserPersistenceStore: TokenDispenserPersistenceStore =
  createInMemoryTokenDispenserPersistenceStore();

export function useTokenDispenserPersistenceStore(store: TokenDispenserPersistenceStore) {
  activeTokenDispenserPersistenceStore = store;
}

export function resetTokenDispenserPersistenceStore() {
  activeTokenDispenserPersistenceStore = createInMemoryTokenDispenserPersistenceStore();
}

export const tokenDispenserTemplateRepository: TokenDispenserTemplateRepository = {
  get(deviceId) {
    return activeTokenDispenserPersistenceStore.templates.get(deviceId);
  },
  save(deviceId, template) {
    return activeTokenDispenserPersistenceStore.templates.save(deviceId, template);
  },
  reset() {
    return activeTokenDispenserPersistenceStore.templates.reset();
  }
};

export const tokenDispenserConnectionRepository: TokenDispenserConnectionRepository = {
  get(deviceId) {
    return activeTokenDispenserPersistenceStore.connections.get(deviceId);
  },
  save(record) {
    return activeTokenDispenserPersistenceStore.connections.save(record);
  },
  reset() {
    return activeTokenDispenserPersistenceStore.connections.reset();
  }
};

export const tokenDispenserLogRepository: TokenDispenserLogRepository = {
  listByDevice(deviceId) {
    return activeTokenDispenserPersistenceStore.logs.listByDevice(deviceId);
  },
  append(entry) {
    return activeTokenDispenserPersistenceStore.logs.append(entry);
  },
  reset() {
    return activeTokenDispenserPersistenceStore.logs.reset();
  }
};
