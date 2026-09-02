import type { AuthSession } from "@jenix/shared";

import { apiOrigin } from "../../../app/apiOrigin";
import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import { getManagedDevice, listManagedDevices } from "../../devices/services/deviceManagementApi";
import { getDeviceUiRuntime } from "../../devices/services/devicePluginRuntimeApi";
import type { PrintTemplate, TokenDispenserLog, TokenDispenserState } from "../types";
import { MOCK_LOGS, MOCK_TEMPLATE } from "../mockData";
import { TOKEN_DISPENSER_PID } from "../tokenDispenserPid";

const base = (deviceId: string) =>
  `${apiOrigin}/api/v1/devices/${encodeURIComponent(deviceId)}/token-dispenser`;

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export interface TokenDispenserDeviceSummary {
  deviceId: string;
  displayName: string;
  onlineStatus: "online" | "offline";
}

export async function listTokenDispenserDevices(
  session: AuthSession
): Promise<TokenDispenserDeviceSummary[]> {
  const devices = await listManagedDevices(session);
  return devices
    .filter((device) => device.pid === TOKEN_DISPENSER_PID)
    .map((device) => ({
      deviceId: device.deviceId,
      displayName: device.displayName,
      onlineStatus: device.online ? ("online" as const) : ("offline" as const)
    }));
}

function readTelemetryString(
  telemetry: Record<string, boolean | number | string>,
  key: string
): string | undefined {
  const value = telemetry[key];
  return value === undefined ? undefined : String(value);
}

function readTelemetryNumber(
  telemetry: Record<string, boolean | number | string>,
  key: string,
  fallback: number
): number {
  const value = telemetry[key];
  return typeof value === "number" ? value : fallback;
}

function readTelemetryBool(
  telemetry: Record<string, boolean | number | string>,
  key: string
): boolean {
  return telemetry[key] === true;
}

const printerStateLabels = [
  "IDLE",
  "PRINTING",
  "PRINTING",
  "ERROR",
  "PAPER_LOW",
  "PAPER_OUT",
  "OFFLINE",
  "ERROR"
] as const;

/**
 * Built from the generic device record + ui-runtime telemetry snapshot
 * (`GET /api/v1/devices/:deviceId` + `.../ui-runtime`) — see
 * canonicalStatusHandlersByPid's TOKEN_DISPENSER_PID entry in
 * runtime.handlers.ts for what actually populates the snapshot (the
 * device's periodic .../status publish, per DEVICE_PACKAGE_RUNTIME.md's
 * runtime call chain). There is no dedicated .../token-dispenser/status
 * REST endpoint — this reuses the same generic path every device uses.
 */
export async function getStatus(
  session: AuthSession,
  deviceId: string
): Promise<TokenDispenserState> {
  const device = await getManagedDevice(session, deviceId);
  const runtime = await getDeviceUiRuntime(session, device);

  const telemetry = runtime.telemetrySnapshot.telemetry;
  const printerStateIndex = readTelemetryNumber(telemetry, "printerState", 0);

  return {
    deviceId,
    online: device.mqttStatus === "online",
    currentToken: readTelemetryString(telemetry, "currentToken") ?? "—",
    lastPrintedToken: readTelemetryString(telemetry, "lastPrintedToken") ?? "—",
    printStatus: "IDLE",
    printerStatus: printerStateLabels[printerStateIndex] ?? "IDLE",
    paperLow: readTelemetryBool(telemetry, "paperLow"),
    estimatedTokensLeft: readTelemetryNumber(telemetry, "estimatedTokensLeft", 0),
    tokensPrintedSinceRollReset: 0,
    mqttStatus: device.mqttStatus === "online" ? "CONNECTED" : "DISCONNECTED",
    httpFallback: false,
    espNowStatus: "INACTIVE",
    wifiRssi: readTelemetryNumber(telemetry, "wifi_rssi", 0),
    uptimeSec: readTelemetryNumber(telemetry, "uptime_sec", 0),
    firmwareVersion: readTelemetryString(telemetry, "firmware_version") ?? device.firmwareVersion ?? "",
    lastSeen: device.lastSeenAt ?? runtime.telemetrySnapshot.occurredAt
  };
}

export async function printNext(
  session: AuthSession,
  deviceId: string
): Promise<{ commandId: string }> {
  return fetchJson(`${base(deviceId)}/print-next`, {
    method: "POST",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" })
  });
}

export async function testPrint(
  session: AuthSession,
  deviceId: string
): Promise<{ commandId: string }> {
  return fetchJson(`${base(deviceId)}/test-print`, {
    method: "POST",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" })
  });
}

export async function resetRoll(session: AuthSession, deviceId: string): Promise<void> {
  await fetchJson(`${base(deviceId)}/reset-roll`, {
    method: "POST",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" })
  });
}

export async function setCounter(
  session: AuthSession,
  deviceId: string,
  value: number
): Promise<void> {
  await fetchJson(`${base(deviceId)}/set-counter`, {
    method: "POST",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" }),
    body: JSON.stringify({ value })
  });
}

export async function setPrefix(
  session: AuthSession,
  deviceId: string,
  prefix: string
): Promise<void> {
  await fetchJson(`${base(deviceId)}/set-prefix`, {
    method: "POST",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" }),
    body: JSON.stringify({ prefix })
  });
}

export async function setLedCount(
  session: AuthSession,
  deviceId: string,
  value: number
): Promise<void> {
  await fetchJson(`${base(deviceId)}/set-led-count`, {
    method: "POST",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" }),
    body: JSON.stringify({ value })
  });
}

export async function getTemplate(
  session: AuthSession,
  deviceId: string
): Promise<PrintTemplate> {
  try {
    return await fetchJson<PrintTemplate>(`${base(deviceId)}/template`, {
      headers: createAuthenticatedHeaders(session)
    });
  } catch {
    return MOCK_TEMPLATE;
  }
}

export async function saveTemplate(
  session: AuthSession,
  deviceId: string,
  template: PrintTemplate
): Promise<void> {
  await fetchJson(`${base(deviceId)}/template`, {
    method: "PUT",
    headers: createAuthenticatedHeaders(session, { contentType: "application/json" }),
    body: JSON.stringify(template)
  });
}

export async function getLogs(
  session: AuthSession,
  deviceId: string
): Promise<TokenDispenserLog[]> {
  try {
    return await fetchJson<TokenDispenserLog[]>(`${base(deviceId)}/logs`, {
      headers: createAuthenticatedHeaders(session)
    });
  } catch {
    return MOCK_LOGS;
  }
}
