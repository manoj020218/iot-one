// Connection config (mqttTenantId/mqttSiteId) and command logs are shared with
// token-dispenser — same firmware family, same topic contract, no reason to duplicate
// that store. See tokenDispenserConnectionRepository / tokenDispenserLogRepository
// (imported directly by billing-dispenser.service.ts).
//
// The one thing genuinely new to this module: which billing-platform license key
// gates a given device's prints. Jenix has no first-class subscription/billing concept
// of its own yet (see MQTT_LICENSED_DEVICE_ACCESS_PLAN.md), so this is a small,
// deliberately scoped store — set once per device during provisioning, alongside the
// connection config, until that plan's Phase C (signed license manifests) lands.

export interface BillingDispenserLicenseConfig {
  deviceId: string;
  licenseKey: string;
}

export interface BillingDispenserLicenseRepository {
  get(deviceId: string): Promise<BillingDispenserLicenseConfig | undefined>;
  save(record: BillingDispenserLicenseConfig): Promise<void>;
  reset(): Promise<void>;
}

function createInMemoryBillingDispenserLicenseRepository(): BillingDispenserLicenseRepository {
  const store = new Map<string, BillingDispenserLicenseConfig>();
  return {
    async get(deviceId) {
      return store.get(deviceId);
    },
    async save(record) {
      store.set(record.deviceId, { ...record });
    },
    async reset() {
      store.clear();
    }
  };
}

let activeRepository: BillingDispenserLicenseRepository = createInMemoryBillingDispenserLicenseRepository();

export function useBillingDispenserLicenseRepository(repository: BillingDispenserLicenseRepository) {
  activeRepository = repository;
}

export function resetBillingDispenserLicenseRepository() {
  activeRepository = createInMemoryBillingDispenserLicenseRepository();
}

export const billingDispenserLicenseRepository: BillingDispenserLicenseRepository = {
  get(deviceId) {
    return activeRepository.get(deviceId);
  },
  save(record) {
    return activeRepository.save(record);
  },
  reset() {
    return activeRepository.reset();
  }
};
