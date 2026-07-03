import type {
  ApiKeyCreateResult,
  ApiKeyRecord,
  ApiPackageRecord
} from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface ApiPackageRepository {
  list(): Promise<ApiPackageRecord[]>;
  get(packageId: string): Promise<ApiPackageRecord | undefined>;
  save(record: ApiPackageRecord): Promise<ApiPackageRecord>;
  reset(): Promise<void>;
}

export interface ApiKeyRepository {
  list(): Promise<ApiKeyRecord[]>;
  get(keyId: string): Promise<ApiKeyRecord | undefined>;
  save(record: ApiKeyRecord): Promise<ApiKeyRecord>;
  reset(): Promise<void>;
}

export interface ApiKeySecretRepository {
  store(result: ApiKeyCreateResult): Promise<void>;
  findKeyBySecret(secret: string): Promise<ApiKeyRecord | undefined>;
  reset(): Promise<void>;
}

export interface ApiAccessPersistenceStore {
  packages: ApiPackageRepository;
  keys: ApiKeyRepository;
  secrets: ApiKeySecretRepository;
}

function createInMemoryApiAccessPersistenceStore(): ApiAccessPersistenceStore {
  const apiPackageStore = new Map<string, ApiPackageRecord>();
  const apiKeyStore = new Map<string, ApiKeyRecord>();
  const apiKeySecretStore = new Map<string, { keyId: string; secret: string }>();

  const packages: ApiPackageRepository = {
    async list() {
      return Array.from(apiPackageStore.values(), (record) => clone(record));
    },
    async get(packageId) {
      const record = apiPackageStore.get(packageId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      apiPackageStore.set(record.packageId, clone(record));
      return clone(record);
    },
    async reset() {
      apiPackageStore.clear();
    }
  };

  const keys: ApiKeyRepository = {
    async list() {
      return Array.from(apiKeyStore.values(), (record) => clone(record));
    },
    async get(keyId) {
      const record = apiKeyStore.get(keyId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      apiKeyStore.set(record.keyId, clone(record));
      return clone(record);
    },
    async reset() {
      apiKeyStore.clear();
    }
  };

  const secrets: ApiKeySecretRepository = {
    async store(result) {
      apiKeySecretStore.set(result.keyId, {
        keyId: result.keyId,
        secret: result.secret
      });
    },
    async findKeyBySecret(secret) {
      const entry = Array.from(apiKeySecretStore.values()).find(
        (candidate) => candidate.secret === secret
      );

      if (!entry) {
        return undefined;
      }

      return keys.get(entry.keyId);
    },
    async reset() {
      apiKeySecretStore.clear();
    }
  };

  return {
    packages,
    keys,
    secrets
  };
}

let activeApiAccessPersistenceStore = createInMemoryApiAccessPersistenceStore();

export function useApiAccessPersistenceStore(store: ApiAccessPersistenceStore) {
  activeApiAccessPersistenceStore = store;
}

export function resetApiAccessPersistenceStore() {
  activeApiAccessPersistenceStore = createInMemoryApiAccessPersistenceStore();
}

export const apiAccessPackageRepository: ApiPackageRepository = {
  list() {
    return activeApiAccessPersistenceStore.packages.list();
  },
  get(packageId) {
    return activeApiAccessPersistenceStore.packages.get(packageId);
  },
  save(record) {
    return activeApiAccessPersistenceStore.packages.save(record);
  },
  reset() {
    return activeApiAccessPersistenceStore.packages.reset();
  }
};

export const apiAccessKeyRepository: ApiKeyRepository = {
  list() {
    return activeApiAccessPersistenceStore.keys.list();
  },
  get(keyId) {
    return activeApiAccessPersistenceStore.keys.get(keyId);
  },
  save(record) {
    return activeApiAccessPersistenceStore.keys.save(record);
  },
  reset() {
    return activeApiAccessPersistenceStore.keys.reset();
  }
};

export const apiAccessKeySecretRepository: ApiKeySecretRepository = {
  store(result) {
    return activeApiAccessPersistenceStore.secrets.store(result);
  },
  findKeyBySecret(secret) {
    return activeApiAccessPersistenceStore.secrets.findKeyBySecret(secret);
  },
  reset() {
    return activeApiAccessPersistenceStore.secrets.reset();
  }
};
