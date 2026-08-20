import {
  QRUNLOCK_DEFAULT_RELAY_COOLDOWN_MS,
  QRUNLOCK_FIXED_RELAY_PULSE_MS
} from "../constants";
import type { QrunlockDeviceSettings } from "./settings.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultSettings(deviceId: string): QrunlockDeviceSettings {
  return {
    deviceId,
    relayPulseMs: QRUNLOCK_FIXED_RELAY_PULSE_MS,
    relayCooldownMs: QRUNLOCK_DEFAULT_RELAY_COOLDOWN_MS,
    relayStateAfterPowerRestore: "remember",
    switchType: "reset",
    updatedAt: new Date(0).toISOString()
  };
}

export type SettingsPatch = Partial<
  Pick<QrunlockDeviceSettings, "relayCooldownMs" | "relayStateAfterPowerRestore" | "switchType">
>;

export interface SettingsRepository {
  get(deviceId: string): Promise<QrunlockDeviceSettings>;
  save(deviceId: string, patch: SettingsPatch): Promise<QrunlockDeviceSettings>;
  reset(): Promise<void>;
}

function createInMemorySettingsRepository(): SettingsRepository {
  const store = new Map<string, QrunlockDeviceSettings>();

  return {
    async get(deviceId) {
      const record = store.get(deviceId);
      return record ? clone(record) : defaultSettings(deviceId);
    },
    async save(deviceId, patch) {
      const current = store.get(deviceId) ?? defaultSettings(deviceId);
      const record: QrunlockDeviceSettings = {
        ...current,
        ...patch,
        deviceId,
        relayPulseMs: QRUNLOCK_FIXED_RELAY_PULSE_MS,
        updatedAt: new Date().toISOString()
      };
      store.set(deviceId, record);
      return clone(record);
    },
    async reset() {
      store.clear();
    }
  };
}

export const settingsRepository: SettingsRepository = createInMemorySettingsRepository();

export async function resetSettingsStore(): Promise<void> {
  await settingsRepository.reset();
}
