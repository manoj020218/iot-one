import type { ApiKeyCreateResult, ApiKeyRecord, ApiPackageRecord } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const apiPackageStore = new Map<string, ApiPackageRecord>();
const apiKeyStore = new Map<string, ApiKeyRecord>();
const apiKeySecretStore = new Map<string, { keyId: string; secret: string }>();

export const apiAccessRepository = {
  listPackages(): ApiPackageRecord[] {
    return Array.from(apiPackageStore.values(), (record) => clone(record));
  },

  getPackage(packageId: string): ApiPackageRecord | undefined {
    const record = apiPackageStore.get(packageId);
    return record ? clone(record) : undefined;
  },

  savePackage(record: ApiPackageRecord): ApiPackageRecord {
    apiPackageStore.set(record.packageId, clone(record));
    return clone(record);
  },

  listKeys(): ApiKeyRecord[] {
    return Array.from(apiKeyStore.values(), (record) => clone(record));
  },

  getKey(keyId: string): ApiKeyRecord | undefined {
    const record = apiKeyStore.get(keyId);
    return record ? clone(record) : undefined;
  },

  saveKey(record: ApiKeyRecord): ApiKeyRecord {
    apiKeyStore.set(record.keyId, clone(record));
    return clone(record);
  },

  storeKeySecret(result: ApiKeyCreateResult) {
    apiKeySecretStore.set(result.keyId, {
      keyId: result.keyId,
      secret: result.secret
    });
  },

  findKeyBySecret(secret: string): ApiKeyRecord | undefined {
    const entry = Array.from(apiKeySecretStore.values()).find(
      (candidate) => candidate.secret === secret
    );

    if (!entry) {
      return undefined;
    }

    return this.getKey(entry.keyId);
  },

  reset() {
    apiPackageStore.clear();
    apiKeyStore.clear();
    apiKeySecretStore.clear();
  }
};
