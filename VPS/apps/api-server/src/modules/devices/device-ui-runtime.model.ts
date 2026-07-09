import type {
  DeviceUiCommandAckRecord,
  DeviceUiRuntimeState,
  DeviceUiTelemetrySnapshotRecord
} from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function createEmptySnapshot(
  deviceId: string,
  pid: string
): DeviceUiTelemetrySnapshotRecord {
  return {
    deviceId,
    pid,
    occurredAt: new Date().toISOString(),
    telemetry: {}
  };
}

function readHistoryPoint(
  snapshot: DeviceUiTelemetrySnapshotRecord
): number | undefined {
  const value = snapshot.telemetry.tankLevelPct;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export interface DeviceUiRuntimeStore {
  get(deviceId: string): Promise<DeviceUiRuntimeState | undefined>;
  saveTelemetry(
    snapshot: DeviceUiTelemetrySnapshotRecord
  ): Promise<DeviceUiRuntimeState>;
  saveSettings(
    deviceId: string,
    settings: Record<string, unknown>,
    pid?: string
  ): Promise<DeviceUiRuntimeState>;
  saveLastCommand(
    deviceId: string,
    ack: DeviceUiCommandAckRecord,
    pid?: string
  ): Promise<DeviceUiRuntimeState>;
  reset(): Promise<void>;
}

function createInMemoryDeviceUiRuntimeStore(): DeviceUiRuntimeStore {
  const store = new Map<string, DeviceUiRuntimeState>();

  return {
    async get(deviceId) {
      const existing = store.get(normalizeDeviceId(deviceId));
      return existing ? clone(existing) : undefined;
    },
    async saveTelemetry(snapshot) {
      const normalizedDeviceId = normalizeDeviceId(snapshot.deviceId);
      const existing = store.get(normalizedDeviceId);
      const history = existing?.telemetrySnapshot.history
        ? [...existing.telemetrySnapshot.history]
        : [];
      const point = readHistoryPoint(snapshot);

      if (point !== undefined) {
        history.push(point);
      }

      const nextState: DeviceUiRuntimeState = {
        deviceId: normalizedDeviceId,
        pid: snapshot.pid,
        telemetrySnapshot: {
          ...clone(snapshot),
          ...(history.length > 0 ? { history: history.slice(-30) } : {})
        },
        ...(existing?.settings ? { settings: clone(existing.settings) } : {}),
        ...(existing?.lastCommand ? { lastCommand: clone(existing.lastCommand) } : {})
      };

      store.set(normalizedDeviceId, nextState);
      return clone(nextState);
    },
    async saveSettings(deviceId, settings, pid) {
      const normalizedDeviceId = normalizeDeviceId(deviceId);
      const existing = store.get(normalizedDeviceId);
      const nextState: DeviceUiRuntimeState = {
        deviceId: normalizedDeviceId,
        pid: existing?.pid ?? pid ?? "UNKNOWN",
        telemetrySnapshot:
          existing?.telemetrySnapshot ??
          createEmptySnapshot(normalizedDeviceId, pid ?? "UNKNOWN"),
        settings: clone(settings),
        ...(existing?.lastCommand ? { lastCommand: clone(existing.lastCommand) } : {})
      };

      store.set(normalizedDeviceId, nextState);
      return clone(nextState);
    },
    async saveLastCommand(deviceId, ack, pid) {
      const normalizedDeviceId = normalizeDeviceId(deviceId);
      const existing = store.get(normalizedDeviceId);
      const nextState: DeviceUiRuntimeState = {
        deviceId: normalizedDeviceId,
        pid: existing?.pid ?? pid ?? "UNKNOWN",
        telemetrySnapshot:
          existing?.telemetrySnapshot ??
          createEmptySnapshot(normalizedDeviceId, pid ?? "UNKNOWN"),
        ...(existing?.settings ? { settings: clone(existing.settings) } : {}),
        lastCommand: clone(ack)
      };

      store.set(normalizedDeviceId, nextState);
      return clone(nextState);
    },
    async reset() {
      store.clear();
    }
  };
}

let activeDeviceUiRuntimeStore = createInMemoryDeviceUiRuntimeStore();

export function useDeviceUiRuntimeStore(store: DeviceUiRuntimeStore) {
  activeDeviceUiRuntimeStore = store;
}

export const deviceUiRuntimeStore: DeviceUiRuntimeStore = {
  get(deviceId) {
    return activeDeviceUiRuntimeStore.get(deviceId);
  },
  saveTelemetry(snapshot) {
    return activeDeviceUiRuntimeStore.saveTelemetry(snapshot);
  },
  saveSettings(deviceId, settings, pid) {
    return activeDeviceUiRuntimeStore.saveSettings(deviceId, settings, pid);
  },
  saveLastCommand(deviceId, ack, pid) {
    return activeDeviceUiRuntimeStore.saveLastCommand(deviceId, ack, pid);
  },
  reset() {
    return activeDeviceUiRuntimeStore.reset();
  }
};
