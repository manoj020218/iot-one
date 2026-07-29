import { afterEach, describe, expect, it, vi } from "vitest";

import { getBleDiscoveryMode, scanBleDevices } from "./bleDiscoveryService";

interface MockScanResult {
  device: {
    deviceId: string;
    name?: string;
  };
  localName?: string;
  rssi?: number;
  serviceUuids?: string[];
}

declare global {
  interface Window {
    Capacitor?: {
      Plugins?: {
        BluetoothLe?: unknown;
      };
    };
  }
}

describe("bleDiscoveryService", () => {
  afterEach(() => {
    delete window.Capacitor;
  });

  it("uses demo mode when the native plugin is unavailable and finds no fabricated devices", async () => {
    expect(getBleDiscoveryMode()).toBe("demo");

    const result = await scanBleDevices({ scanWindowMs: 0 });
    expect(result.bluetoothEnabled).toBe(true);
    expect(result.permissionDenied).toBe(false);
    expect(result.devices).toHaveLength(0);
  });

  it("runs the two-pass native quick scan and filters likely Jenix devices", async () => {
    const listeners: Array<(result: MockScanResult) => void> = [];
    const plugin = {
      requestPermissions: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({
        value: true
      }),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockImplementation(
        async (
          _eventName: "onScanResult",
          listener: (result: MockScanResult) => void
        ) => {
          listeners.push(listener);
          return {
            remove: vi.fn().mockResolvedValue(undefined)
          };
        }
      ),
      requestLEScan: vi.fn().mockImplementation(
        async (options: { namePrefix?: string }) => {
          const emit = listeners[listeners.length - 1];

          if (!emit) {
            return;
          }

          if (options.namePrefix) {
            emit({
              device: {
                deviceId: "AA:BB:CC:DD:EE:01"
              },
              localName: "JNX-TG-C3-A7F2",
              rssi: -68
            });
            emit({
              device: {
                deviceId: "AA:BB:CC:DD:EE:02"
              },
              localName: "Random Sensor",
              rssi: -30
            });
            return;
          }

          emit({
            device: {
              deviceId: "AA:BB:CC:DD:EE:03"
            },
            localName: "Unknown",
            rssi: -44,
            serviceUuids: ["0000ff00-0000-1000-8000-00805f9b34fb"]
          });
          emit({
            device: {
              deviceId: "AA:BB:CC:DD:EE:01"
            },
            localName: "JNX-TG-C3-A7F2",
            rssi: -41
          });
        }
      ),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    };

    window.Capacitor = {
      Plugins: {
        BluetoothLe: plugin
      }
    };

    const result = await scanBleDevices({
      scanWindowMs: 0
    });

    expect(getBleDiscoveryMode()).toBe("native");
    expect(plugin.requestLEScan).toHaveBeenCalledTimes(1);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]?.deviceId).toBe("JNX-TG-C3-A7F2");
    expect(result.devices[0]?.transportId).toBe("AA:BB:CC:DD:EE:01");
  });

  it("retries with the broader matcher when the prefix pass finds nothing", async () => {
    const listeners: Array<(result: MockScanResult) => void> = [];
    const plugin = {
      requestPermissions: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({
        value: true
      }),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockImplementation(
        async (
          _eventName: "onScanResult",
          listener: (result: MockScanResult) => void
        ) => {
          listeners.push(listener);
          return {
            remove: vi.fn().mockResolvedValue(undefined)
          };
        }
      ),
      requestLEScan: vi.fn().mockImplementation(
        async (options: { namePrefix?: string }) => {
          const emit = listeners[listeners.length - 1];

          if (!emit) {
            return;
          }

          if (options.namePrefix) {
            return;
          }

          emit({
            device: {
              deviceId: "AA:BB:CC:DD:EE:04"
            },
            localName: "Unknown",
            rssi: -39,
            serviceUuids: ["0000ff00-0000-1000-8000-00805f9b34fb"]
          });
        }
      ),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    };

    window.Capacitor = {
      Plugins: {
        BluetoothLe: plugin
      }
    };

    const result = await scanBleDevices({
      scanWindowMs: 0
    });

    expect(plugin.requestLEScan).toHaveBeenCalledTimes(2);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]?.transportId).toBe("AA:BB:CC:DD:EE:04");
  });

  it("reports bluetoothEnabled=false without scanning when the adapter is off", async () => {
    const plugin = {
      requestPermissions: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({ value: false }),
      requestEnable: vi.fn().mockRejectedValue(new Error("user declined")),
      addListener: vi.fn(),
      requestLEScan: vi.fn(),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    };

    window.Capacitor = {
      Plugins: {
        BluetoothLe: plugin
      }
    };

    const result = await scanBleDevices({ scanWindowMs: 0 });

    expect(result.bluetoothEnabled).toBe(false);
    expect(result.permissionDenied).toBe(false);
    expect(result.devices).toHaveLength(0);
    expect(plugin.requestLEScan).not.toHaveBeenCalled();
  });

  it("reports permissionDenied=true without scanning when permission is refused", async () => {
    const plugin = {
      requestPermissions: vi.fn().mockRejectedValue(new Error("denied")),
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({ value: true }),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn(),
      requestLEScan: vi.fn(),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    };

    window.Capacitor = {
      Plugins: {
        BluetoothLe: plugin
      }
    };

    const result = await scanBleDevices({ scanWindowMs: 0 });

    expect(result.bluetoothEnabled).toBe(true);
    expect(result.permissionDenied).toBe(true);
    expect(result.devices).toHaveLength(0);
    expect(plugin.requestLEScan).not.toHaveBeenCalled();
  });
});
