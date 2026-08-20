import { randomUUID } from "node:crypto";
import * as https from "node:https";

import type { DeviceRecord } from "@jenix/shared";

import { getRuntimeMqttBridge } from "../../infrastructure/mqtt/runtime.binding";
import { deviceRepository } from "../devices/device.model";
import type { DeviceRequestContext } from "../devices/device.types";
import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";

// Same firmware family as Token Dispenser (same PID hardware, relaunched as its own
// product) — reuse its connection-config store (mqttTenantId/mqttSiteId per device)
// and command log rather than duplicating an identical collection.
import { buildTokenDispenserTopic } from "../token-dispenser/token-dispenser.service";
import { tokenDispenserConnectionRepository, tokenDispenserLogRepository } from "../token-dispenser/token-dispenser.model";
import type { TokenDispenserLogSource } from "../token-dispenser/token-dispenser.types";

import { billingDispenserLicenseRepository } from "./billing-dispenser.model";
import { buildElements } from "./billing-dispenser.validation";
import { BillingDispenserModuleError, type PrintCustomRequest } from "./billing-dispenser.types";

const connectionLabel = "default";

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function resolveDeviceContext(
  deviceId: string,
  context: DeviceRequestContext
): Promise<{ device: DeviceRecord; context: DeviceRequestContext }> {
  let resolvedContext: DeviceRequestContext;

  try {
    resolvedContext = await resolveHomeAccessContext(context);
  } catch (error) {
    if (error instanceof HomeModuleError) {
      throw new BillingDispenserModuleError(error.statusCode, error.message);
    }
    throw error;
  }

  const device = await deviceRepository.get(normalizeDeviceId(deviceId));
  if (!device) {
    throw new BillingDispenserModuleError(404, `Device not found: ${normalizeDeviceId(deviceId)}`);
  }

  if (resolvedContext.homeId && device.homeId !== resolvedContext.homeId) {
    throw new BillingDispenserModuleError(403, "Device access denied");
  }

  if (!resolvedContext.homeRole && resolvedContext.userId && device.ownerUserId !== resolvedContext.userId) {
    throw new BillingDispenserModuleError(403, "Device access denied");
  }

  return { device, context: resolvedContext };
}

function appendLog(deviceId: string, entry: { level: "info" | "warn" | "error"; action: string; source: TokenDispenserLogSource; userId?: string; detail?: string }) {
  return tokenDispenserLogRepository.append({
    logId: randomUUID(),
    deviceId,
    timestamp: nowIso(),
    ...entry
  });
}

// ---------------------------------------------------------------------------
// Subscription gate — deliberately scoped shortcut, not real platform enforcement.
//
// Jenix has no first-class billing/subscription concept yet (see
// MQTT_LICENSED_DEVICE_ACCESS_PLAN.md — Phases A-E, none built). This calls the
// same billing-platform endpoint HotelQR-Lite already checks before it ever gets
// here, fails CLOSED, and is the print path's *second* independent check — it must
// not assume the caller already gated correctly. Replace with a real entitlement
// service once that plan's phases land; this is not it.
// ---------------------------------------------------------------------------
const _subscriptionCache = new Map<string, { valid: boolean; fetchedAt: number }>();
const SUBSCRIPTION_CACHE_MS = 15 * 60 * 1000;

// Rejects (never resolves false) on a network/parse failure — the caller treats a
// rejection as fail-closed-but-uncacheable, so a transient billing-platform hiccup
// doesn't poison every print attempt for the next 15 minutes.
function httpCheckPrintSubscription(licenseKey: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const url = `https://iotsoft.in/api/license/check?key=${encodeURIComponent(licenseKey)}`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (d) => { data += d; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as { valid?: boolean };
            resolve(parsed.valid === true);
          } catch {
            reject(new Error("check_failed"));
          }
        });
      })
      .on("error", () => reject(new Error("check_failed")));
  });
}

// Swappable so tests never hit the real network — mirrors useRuntimeMqttBridge's pattern.
// Defaults to the real billing-platform call. Same reject-means-uncacheable contract.
let _subscriptionChecker: (licenseKey: string) => Promise<boolean> = httpCheckPrintSubscription;

export function useSubscriptionChecker(checker: (licenseKey: string) => Promise<boolean>): void {
  _subscriptionChecker = checker;
}

async function checkPrintSubscription(licenseKey: string | undefined): Promise<boolean> {
  if (!licenseKey) return false;

  const cached = _subscriptionCache.get(licenseKey);
  if (cached && Date.now() - cached.fetchedAt < SUBSCRIPTION_CACHE_MS) return cached.valid;

  try {
    const valid = await _subscriptionChecker(licenseKey);
    _subscriptionCache.set(licenseKey, { valid, fetchedAt: Date.now() });
    return valid;
  } catch {
    return false; // fail closed, not cached
  }
}

async function dispatchCommand(
  device: DeviceRecord,
  command: string,
  extra: Record<string, unknown>,
  action: string,
  userId: string | undefined
): Promise<{ commandId: string; dispatched: boolean }> {
  const connection = (await tokenDispenserConnectionRepository.get(device.deviceId)) ?? {
    deviceId: device.deviceId,
    mqttTenantId: connectionLabel,
    mqttSiteId: connectionLabel
  };
  const topic = buildTokenDispenserTopic(connection.mqttTenantId, connection.mqttSiteId, device.deviceId, "command");
  const commandId = randomUUID();
  const bridge = getRuntimeMqttBridge();
  let dispatched = false;

  if (bridge?.publishRaw) {
    await bridge.publishRaw(topic, { command, command_id: commandId, ...extra });
    dispatched = true;
  }

  await appendLog(device.deviceId, {
    level: "info",
    action,
    source: "PWA",
    ...(userId ? { userId } : {})
  });

  return { commandId, dispatched };
}

export async function printCustom(
  deviceId: string,
  request: PrintCustomRequest,
  context: DeviceRequestContext
): Promise<{ commandId: string }> {
  const { device, context: resolvedContext } = await resolveDeviceContext(deviceId, context);

  const license = await billingDispenserLicenseRepository.get(device.deviceId);
  const subscriptionOk = await checkPrintSubscription(license?.licenseKey);
  if (!subscriptionOk) {
    await appendLog(device.deviceId, {
      level: "warn",
      action: "PRINT_BLOCKED_SUBSCRIPTION",
      source: "PWA",
      ...(resolvedContext.userId ? { userId: resolvedContext.userId } : {})
    });
    throw new BillingDispenserModuleError(402, "Subscription inactive — printing is paused for this device");
  }

  const elements = buildElements(request);
  const { commandId } = await dispatchCommand(
    device,
    "PRINT_CUSTOM_JSON",
    { payload: JSON.stringify({ elements }) },
    `PRINT_CUSTOM_JSON:${request.ticketType}`,
    resolvedContext.userId
  );
  return { commandId };
}

export const billingDispenserTesting = {
  reset() {
    _subscriptionCache.clear();
    _subscriptionChecker = httpCheckPrintSubscription;
    return billingDispenserLicenseRepository.reset();
  }
};
