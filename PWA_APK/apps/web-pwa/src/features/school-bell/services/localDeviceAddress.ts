/**
 * Per-device local-network settings, kept in this browser/app install only
 * (never sent to the VPS — see DEVICE_PACKAGE_RUNTIME.md's "minimum VPS
 * use" direction for School Bell). Two things live here:
 *
 * 1. The device's local base URL (its LAN IP/hostname once it has joined
 *    school Wi-Fi, e.g. "http://192.168.1.42" or "http://192.168.4.1"
 *    while still in its own setup AP). There is no discovery/mDNS story
 *    yet — provisioning is explicitly out of scope for this pass — so
 *    this is entered once by an admin in Settings and reused after that,
 *    the same value a future provisioning flow would populate
 *    automatically without changing anything that reads it here.
 * 2. Whether cloud/remote control is opted into for this device. Off by
 *    default everywhere — local control always works without it.
 */

const ADDRESS_PREFIX = "schoolbell:local-address:";
const CLOUD_PREFIX = "schoolbell:cloud-enabled:";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing / storage disabled — the value just won't persist.
  }
}

export function getLocalDeviceAddress(deviceId: string): string | null {
  const stored = safeGet(ADDRESS_PREFIX + deviceId);
  return stored ? stored.replace(/\/+$/, "") : null;
}

export function setLocalDeviceAddress(deviceId: string, baseUrl: string): void {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  safeSet(ADDRESS_PREFIX + deviceId, normalized);
}

export function isCloudControlEnabled(deviceId: string): boolean {
  return safeGet(CLOUD_PREFIX + deviceId) === "1";
}

export function setCloudControlEnabled(deviceId: string, enabled: boolean): void {
  safeSet(CLOUD_PREFIX + deviceId, enabled ? "1" : "0");
}
