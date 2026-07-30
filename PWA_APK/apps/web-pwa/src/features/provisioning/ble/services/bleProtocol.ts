/**
 * Wire protocol for talking to a Jenix device over BLE once connected, per
 * PROVISIONING.md (repo root) -- one JSON command/response channel on a
 * single characteristic: write a command, poll-read the same characteristic
 * until a response matching the expected shape shows up.
 *
 * This mirrors the technique already proven in the FloodGuard app
 * (D:\IOT Device\RUB\FloodGuard\APK\src\pages\InstallPage.tsx) so every
 * Jenix product can share one implementation instead of a bespoke one per
 * device.
 */

export const BLE_SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb";
export const BLE_CHARACTERISTIC_UUID = "0000ff01-0000-1000-8000-00805f9b34fb";

const RESPONSE_POLL_MS = 250;
const DEFAULT_RESPONSE_TIMEOUT_MS = 8000;

export interface NativeBleClient {
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

export interface BleHelloResponse {
  ok: true;
  cmd: "hello";
  pid?: string;
  ble_name?: string;
  wifi_connected: boolean;
  ssid?: string;
  ip?: string;
}

export interface BleWifiNetwork {
  ssid: string;
  rssi: number;
}

export interface BleWifiScanResponse {
  ok: true;
  cmd: "scan_wifi";
  networks: BleWifiNetwork[];
}

export interface BleSetWifiResponse {
  ok: true;
  cmd: "set_wifi";
  wifi_connected: boolean;
  ip?: string;
}

export interface BleCloudStatusResponse {
  ok: true;
  cmd: "c";
  wifi_connected: boolean;
  mqtt_connected: boolean;
}

export interface BleErrorResponse {
  ok: false;
  error: string;
}

function textToHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToText(hex: string): string {
  const bytes = hex.match(/.{1,2}/g) ?? [];
  const buffer = Uint8Array.from(bytes.map((byte) => parseInt(byte, 16)));
  return new TextDecoder().decode(buffer);
}

function dataViewFromHex(hex: string): DataView {
  const bytes = hex.match(/.{1,2}/g) ?? [];
  const buffer = new Uint8Array(bytes.map((byte) => parseInt(byte, 16)));
  return new DataView(buffer.buffer);
}

function dataViewToHex(view: DataView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectToDevice(
  ble: NativeBleClient,
  transportId: string,
  onDisconnect?: (deviceId: string) => void
): Promise<void> {
  await ble.connect(transportId, onDisconnect, { timeout: 8000 });
}

export async function disconnectFromDevice(
  ble: NativeBleClient,
  transportId: string
): Promise<void> {
  try {
    await ble.disconnect(transportId);
  } catch {
    // Already disconnected (e.g. the device dropped the link itself) -- fine.
  }
}

export interface SendJsonCommandOptions<T> {
  timeoutMs?: number;
  validate: (value: unknown) => value is T;
}

/**
 * Writes a JSON command to the provisioning characteristic, then polls the
 * same characteristic (write-then-poll-read, no correlation id) until a
 * response matching `validate` shows up or the timeout elapses.
 */
export async function sendJsonCommand<T>(
  ble: NativeBleClient,
  transportId: string,
  payload: Record<string, unknown>,
  options: SendJsonCommandOptions<T>
): Promise<T> {
  const hex = textToHex(JSON.stringify(payload));
  await ble.write(
    transportId,
    BLE_SERVICE_UUID,
    BLE_CHARACTERISTIC_UUID,
    dataViewFromHex(hex),
    { timeout: 5000 }
  );

  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS);

  while (Date.now() < deadline) {
    await delay(RESPONSE_POLL_MS);

    try {
      const view = await ble.read(
        transportId,
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTIC_UUID,
        { timeout: 3000 }
      );
      const raw = hexToText(dataViewToHex(view)).trim();

      if (!raw) {
        continue;
      }

      const parsed: unknown = JSON.parse(raw);

      if (options.validate(parsed)) {
        return parsed;
      }

      if (isErrorResponse(parsed)) {
        throw new Error(parsed.error);
      }
    } catch (readError) {
      if (readError instanceof SyntaxError) {
        continue;
      }

      throw readError;
    }
  }

  throw new Error(`Device did not respond to "${String(payload.cmd)}" in time.`);
}

function isErrorResponse(value: unknown): value is BleErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

export function isHelloResponse(value: unknown): value is BleHelloResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { cmd?: unknown }).cmd === "hello" &&
    (value as { ok?: unknown }).ok === true
  );
}

export function isWifiScanResponse(value: unknown): value is BleWifiScanResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { cmd?: unknown }).cmd === "scan_wifi" &&
    Array.isArray((value as { networks?: unknown }).networks)
  );
}

export function isSetWifiResponse(value: unknown): value is BleSetWifiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { cmd?: unknown }).cmd === "set_wifi" &&
    typeof (value as { wifi_connected?: unknown }).wifi_connected === "boolean"
  );
}

export function isCloudStatusResponse(value: unknown): value is BleCloudStatusResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { cmd?: unknown }).cmd === "c" &&
    typeof (value as { mqtt_connected?: unknown }).mqtt_connected === "boolean"
  );
}
