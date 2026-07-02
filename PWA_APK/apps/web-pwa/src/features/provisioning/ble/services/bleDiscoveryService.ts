import { foundationPidBlueprint } from "@jenix/device-schemas";

import type { BleScanDevice } from "../../provisioning.types";

const BLE_NAME_PREFIX = "JNX";
const BLE_NAME_KEYWORDS = ["JENIX", "TANK GUARD", "SMART TANK GUARD"];
const BLE_SERVICE_HINTS = ["ff00"];
const DEFAULT_SCAN_WINDOW_MS = 3500;

const demoScanInventory: BleScanDevice[] = [
  {
    transportId: "JNX-TG-C3-A7F2",
    deviceId: "JNX-TG-C3-A7F2",
    pid: foundationPidBlueprint.pid,
    productName: foundationPidBlueprint.productName,
    iconText: "TG",
    rssi: -43,
    provisioningReady: true
  },
  {
    transportId: "JNX-TG-C3-B9D4",
    deviceId: "JNX-TG-C3-B9D4",
    pid: foundationPidBlueprint.pid,
    productName: `${foundationPidBlueprint.productName} Edge`,
    iconText: "TE",
    rssi: -51,
    provisioningReady: true
  }
];

interface NativeBleScanResult {
  localName?: string;
  device?: {
    deviceId?: string;
    name?: string;
  };
  rssi?: number;
  uuids?: string[];
  serviceUuids?: string[];
}

interface NativeBleListenerHandle {
  remove: () => Promise<void> | void;
}

interface NativeBluetoothLePlugin {
  requestPermissions?: () => Promise<void>;
  initialize: (options: { androidNeverForLocation: boolean }) => Promise<void>;
  isEnabled: () => Promise<{ value: boolean } | undefined>;
  requestEnable?: () => Promise<void>;
  addListener: (
    eventName: "onScanResult",
    listener: (result: NativeBleScanResult) => void
  ) => Promise<NativeBleListenerHandle> | NativeBleListenerHandle;
  requestLEScan: (options: {
    namePrefix?: string;
    allowDuplicates?: boolean;
  }) => Promise<void>;
  stopLEScan: () => Promise<void>;
}

export type BleDiscoveryMode = "native" | "demo";

export interface BleScanOptions {
  scanWindowMs?: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBlePlugin(): NativeBluetoothLePlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (
    window as Window & {
      Capacitor?: {
        Plugins?: {
          BluetoothLe?: NativeBluetoothLePlugin;
        };
      };
    }
  ).Capacitor?.Plugins?.BluetoothLe;

  return candidate ?? null;
}

function normalizeDeviceName(scanResult: NativeBleScanResult): string {
  return (
    scanResult.localName ||
    scanResult.device?.name ||
    scanResult.device?.deviceId ||
    "Unknown"
  );
}

function isLikelyJenixDevice(
  result: NativeBleScanResult,
  normalizedName: string
): boolean {
  const upperName = normalizedName.toUpperCase();

  if (
    upperName.startsWith(BLE_NAME_PREFIX) ||
    BLE_NAME_KEYWORDS.some((keyword) => upperName.includes(keyword))
  ) {
    return true;
  }

  const serviceIds = [
    ...(Array.isArray(result.uuids) ? result.uuids : []),
    ...(Array.isArray(result.serviceUuids) ? result.serviceUuids : [])
  ].map((item) => String(item || "").toLowerCase());

  return serviceIds.some((serviceId) =>
    BLE_SERVICE_HINTS.some((hint) => serviceId.includes(hint))
  );
}

function deriveBusinessDeviceId(rawName: string, transportId: string): string {
  const normalizedName = rawName
    .toUpperCase()
    .replace(/[^A-Z0-9- ]/g, " ")
    .trim();
  const match = normalizedName.match(/JNX(?:[- ][A-Z0-9]+){2,4}/);

  if (match?.[0]) {
    return match[0].replace(/ /g, "-");
  }

  const cleanTransportId = transportId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(-4);

  return `JNX-TG-C3-${cleanTransportId || "DEMO"}`;
}

function mapNativeResultToBleScanDevice(result: NativeBleScanResult): BleScanDevice | null {
  const transportId = String(result.device?.deviceId || "").trim();

  if (!transportId) {
    return null;
  }

  const rawName = String(normalizeDeviceName(result) || "").trim();
  const deviceId = deriveBusinessDeviceId(rawName, transportId);
  const productName =
    rawName && rawName !== "Unknown" ? rawName : foundationPidBlueprint.productName;

  return {
    transportId,
    deviceId,
    pid: foundationPidBlueprint.pid,
    productName,
    iconText: "TG",
    rssi: Number.isFinite(result.rssi) ? Math.round(result.rssi ?? 0) : -999,
    provisioningReady: true
  };
}

async function ensureBleReady(ble: NativeBluetoothLePlugin) {
  try {
    await ble.requestPermissions?.();
  } catch {
    // Some platforms do not expose a permission request surface.
  }

  await ble.initialize({
    androidNeverForLocation: false
  });

  const enabled = await ble.isEnabled();
  if (!enabled?.value) {
    await ble.requestEnable?.();
  }
}

async function runNativeScanPass(
  ble: NativeBluetoothLePlugin,
  discovered: Map<string, BleScanDevice>,
  options: {
    scanWindowMs: number;
    strictPrefixOnly: boolean;
  }
) {
  let listener: NativeBleListenerHandle | null = null;

  try {
    listener = await ble.addListener("onScanResult", (result) => {
      const transportId = String(result.device?.deviceId || "").trim();

      if (!transportId) {
        return;
      }

      const rawName = String(normalizeDeviceName(result) || "").trim();
      const upperName = rawName.toUpperCase();
      const likely = isLikelyJenixDevice(result, rawName);

      if (options.strictPrefixOnly && !upperName.startsWith(BLE_NAME_PREFIX)) {
        return;
      }

      if (!options.strictPrefixOnly && !likely) {
        return;
      }

      const mapped = mapNativeResultToBleScanDevice(result);
      if (!mapped) {
        return;
      }

      const existing = discovered.get(mapped.transportId);
      if (!existing || mapped.rssi > existing.rssi) {
        discovered.set(mapped.transportId, mapped);
      }
    });

    await ble.requestLEScan({
      ...(options.strictPrefixOnly ? { namePrefix: BLE_NAME_PREFIX } : {}),
      allowDuplicates: false
    });

    await delay(options.scanWindowMs);
  } finally {
    try {
      await ble.stopLEScan();
    } catch {
      // Ignore scan stop errors during cleanup.
    }

    await listener?.remove();
  }
}

export function getBleDiscoveryMode(): BleDiscoveryMode {
  return getBlePlugin() ? "native" : "demo";
}

export async function scanBleDevices(
  options: BleScanOptions = {}
): Promise<BleScanDevice[]> {
  const ble = getBlePlugin();

  if (!ble) {
    return clone(demoScanInventory);
  }

  const scanWindowMs = options.scanWindowMs ?? DEFAULT_SCAN_WINDOW_MS;
  const discovered = new Map<string, BleScanDevice>();

  await ensureBleReady(ble);
  await runNativeScanPass(ble, discovered, {
    scanWindowMs,
    strictPrefixOnly: true
  });

  if (discovered.size === 0) {
    await runNativeScanPass(ble, discovered, {
      scanWindowMs,
      strictPrefixOnly: false
    });
  }

  return Array.from(discovered.values()).sort((left, right) => right.rssi - left.rssi);
}

export const bleDiscoveryTesting = {
  demoScanInventory: clone(demoScanInventory)
};
