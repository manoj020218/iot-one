import { foundationPidBlueprint } from "@jenix/device-schemas";

import type { BleScanDevice } from "../../provisioning.types";
import { BLE_SERVICE_UUID } from "./bleProtocol";

/**
 * Naming/UUID scheme defined in PROVISIONING.md (repo root) -- "JNX" is the
 * brand-wide prefix every product's BLE name starts with
 * (JNX{ProductCode}{6-hex-MAC}); the exact product is identified from the
 * `hello` response's `pid` field once connected, not from the advertised
 * name alone.
 */
const BLE_NAME_PREFIX = "JNX";
const BLE_NAME_KEYWORDS = ["JENIX", "TANK GUARD", "SMART TANK GUARD"];
const DEFAULT_SCAN_WINDOW_MS = 3500;
const DEMO_SCAN_DELAY_MS = 1200;

function normalizeUuid(uuid: string): string {
  return uuid.trim().toLowerCase();
}

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

export interface NativeBluetoothLePlugin {
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
  connect: (
    deviceId: string,
    onDisconnect?: (deviceId: string) => void,
    options?: { timeout?: number }
  ) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  write: (
    deviceId: string,
    service: string,
    characteristic: string,
    value: DataView,
    options?: { timeout?: number }
  ) => Promise<void>;
  read: (
    deviceId: string,
    service: string,
    characteristic: string,
    options?: { timeout?: number }
  ) => Promise<DataView>;
}

export type BleDiscoveryMode = "native" | "demo";

export interface BleScanOptions {
  scanWindowMs?: number;
}

export interface BleScanResult {
  devices: BleScanDevice[];
  bluetoothEnabled: boolean;
  permissionDenied: boolean;
}

interface BleReadinessResult {
  ready: boolean;
  bluetoothEnabled: boolean;
  permissionDenied: boolean;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getBlePlugin(): NativeBluetoothLePlugin | null {
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
  ].map((item) => normalizeUuid(String(item || "")));

  return serviceIds.includes(normalizeUuid(BLE_SERVICE_UUID));
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

async function ensureBleReady(ble: NativeBluetoothLePlugin): Promise<BleReadinessResult> {
  let permissionDenied = false;

  try {
    await ble.requestPermissions?.();
  } catch {
    // Most platforms reject here when Location/Bluetooth permission was refused.
    permissionDenied = true;
  }

  await ble.initialize({
    androidNeverForLocation: false
  });

  let bluetoothEnabled = Boolean((await ble.isEnabled())?.value);

  if (!bluetoothEnabled) {
    try {
      await ble.requestEnable?.();
      bluetoothEnabled = Boolean((await ble.isEnabled())?.value);
    } catch {
      bluetoothEnabled = false;
    }
  }

  return {
    ready: bluetoothEnabled && !permissionDenied,
    bluetoothEnabled,
    permissionDenied
  };
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
): Promise<BleScanResult> {
  const ble = getBlePlugin();

  if (!ble) {
    await delay(options.scanWindowMs ?? DEMO_SCAN_DELAY_MS);
    return {
      devices: [],
      bluetoothEnabled: true,
      permissionDenied: false
    };
  }

  const readiness = await ensureBleReady(ble);

  if (!readiness.ready) {
    return {
      devices: [],
      bluetoothEnabled: readiness.bluetoothEnabled,
      permissionDenied: readiness.permissionDenied
    };
  }

  const scanWindowMs = options.scanWindowMs ?? DEFAULT_SCAN_WINDOW_MS;
  const discovered = new Map<string, BleScanDevice>();

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

  return {
    devices: Array.from(discovered.values()).sort((left, right) => right.rssi - left.rssi),
    bluetoothEnabled: true,
    permissionDenied: false
  };
}
