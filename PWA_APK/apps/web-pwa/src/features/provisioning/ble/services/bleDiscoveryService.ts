import { allPidBlueprints, type CreatePidInput } from "@jenix/device-schemas";

import type { BleScanDevice } from "../../provisioning.types";
import { BLE_SERVICE_UUID } from "./bleProtocol";

/**
 * Naming/UUID scheme defined in PROVISIONING.md (repo root) -- "JNX" is the
 * brand-wide prefix every product's BLE name starts with, followed by a
 * 2-4 letter product code and the last 6 hex digits of the device's Wi-Fi
 * STA MAC, no separators (Section 2's table: JNXTGBAF968, JNXQRUC0DCCB,
 * etc.). This is a best-effort *discovery-time* guess at product identity,
 * looked up generically against every known PID blueprint instead of one
 * hardcoded product (see PROVISIONING.md's onboarding-readiness plan,
 * Workstream A, for the mislabeling bug this replaces) -- the real,
 * authenticated product identity still only comes from the `hello`
 * response once connected (Section 10's protocomm work), which is what
 * actually needs to confirm this guess before anything sensitive happens.
 */
const BLE_NAME_PREFIX = "JNX";
const BLE_NAME_PATTERN = /^JNX([A-Z0-9]{2,4})([0-9A-F]{6})$/;
const BLE_NAME_KEYWORDS = ["JENIX", "TANK GUARD", "SMART TANK GUARD"];
const DEFAULT_SCAN_WINDOW_MS = 3500;
const DEMO_SCAN_DELAY_MS = 1200;

interface ProductCatalogEntry {
  pid: string;
  productName: string;
  iconText: string;
}

/**
 * Product-code segment of a PID ("JNX-QRU-C3-001" -> "QRU") mapped to the
 * blueprint's real identity. Built from packages/device-schemas'
 * allPidBlueprints, so registering a new device there (Workstream B) is the
 * only step needed to make BLE discovery recognize it correctly too -- no
 * second, hand-maintained copy of this mapping to drift out of sync.
 */
function buildProductCatalog(): Map<string, ProductCatalogEntry> {
  const catalog = new Map<string, ProductCatalogEntry>();

  for (const blueprint of allPidBlueprints as CreatePidInput[]) {
    const code = blueprint.pid.split("-")[1];

    if (!code) {
      continue;
    }

    catalog.set(code, {
      pid: blueprint.pid,
      productName: blueprint.productName,
      iconText: (blueprint.dashboard.icon ?? code).slice(0, 2).toUpperCase()
    });
  }

  return catalog;
}

const productCatalog = buildProductCatalog();

/**
 * "JNX-QRU-C3-001" + "C0DCCB" -> "JNX-QRU-C3-C0DCCB", matching the real
 * device-id format firmware itself builds (DeviceIdentity.cpp's
 * kDeviceIdPrefix + "-" + macSuffix) -- strips the PID's trailing
 * product-instance number, not something derivable from the BLE name alone.
 */
function deriveDeviceIdFromPid(pid: string, macSuffix: string): string {
  return `${pid.replace(/-\d+$/, "")}-${macSuffix}`;
}

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

function mapNativeResultToBleScanDevice(result: NativeBleScanResult): BleScanDevice | null {
  const transportId = String(result.device?.deviceId || "").trim();

  if (!transportId) {
    return null;
  }

  const rawName = String(normalizeDeviceName(result) || "").trim();
  const match = rawName.toUpperCase().match(BLE_NAME_PATTERN);

  if (!match) {
    // Doesn't follow the canonical JNX{code}{6-hex-MAC} format, but the
    // caller (runNativeScanPass's broader pass) only reaches this function
    // at all when isLikelyJenixDevice() already matched -- typically the
    // provisioning service UUID, with the advertised name not yet readable.
    // Surface it as present-but-unidentified instead of either fabricating
    // a name-derived identity or silently dropping a real device.
    if (isLikelyJenixDevice(result, rawName)) {
      return {
        transportId,
        deviceId: transportId,
        pid: "",
        productName: "Unidentified Jenix device",
        iconText: "?",
        rssi: Number.isFinite(result.rssi) ? Math.round(result.rssi ?? 0) : -999,
        provisioningReady: false
      };
    }

    // Not a Jenix device by any signal -- don't fabricate an identity for
    // it (this is exactly what the old code did, hardcoding Tank Guard's
    // onto everything regardless of what was actually scanned).
    return null;
  }

  const [, code, macSuffix] = match;

  if (!code || !macSuffix) {
    return null;
  }

  const product = productCatalog.get(code);

  if (!product) {
    // A compliant name, but not one we have a catalog entry for -- surface
    // it as a real, distinct entry so it's visibly unrecognized rather than
    // silently mislabeled as some other product. provisioningReady: false
    // keeps the UI's existing "disable Add for non-ready devices" behavior
    // (BleDeviceCard.tsx) as the safety net.
    return {
      transportId,
      deviceId: `JNX-${code}-${macSuffix}`,
      pid: "",
      productName: `Unrecognized Jenix device (${code})`,
      iconText: "?",
      rssi: Number.isFinite(result.rssi) ? Math.round(result.rssi ?? 0) : -999,
      provisioningReady: false
    };
  }

  return {
    transportId,
    deviceId: deriveDeviceIdFromPid(product.pid, macSuffix),
    pid: product.pid,
    productName: product.productName,
    iconText: product.iconText,
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
