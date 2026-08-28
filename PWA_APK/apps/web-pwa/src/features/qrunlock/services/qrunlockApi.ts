import {
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type DeviceRecord
} from "@jenix/shared";

import { apiOrigin } from "../../../app/apiOrigin";
import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import { fetchAuthenticatedJson } from "../../../app/authenticatedRequest";

// Mirrors IOT_Device/QRunlock/VPS/API_CONTRACT.md exactly — this module
// has no fallback/demo store (unlike sceneApi.ts, deviceManagementApi.ts):
// QRunlock is a brand-new plugin, not part of the legacy offline-first
// dashboard, so real errors surface to the caller instead of masking them
// behind fabricated local state.

const qrunlockEndpoint = `${apiOrigin}/api/v1/qrunlock`;
const deviceActionEndpoint = `${apiOrigin}/api/v1/devices`;

export type QrunlockRfLearnStatus = "idle" | "learning" | "learned" | "cancelled" | "timeout";
export type RelayPowerRestoreMode = "on" | "off" | "remember";
export type SwitchType = "reset" | "toggle" | "state";

export interface QrunlockDeviceSummary {
  deviceId: string;
  friendlyName: string;
  onlineStatus: "online" | "offline";
  relayState: "idle" | "pulsing";
  lastUnlockAt: string | null;
  lastUnlockReason: string | null;
  rfLearnStatus: QrunlockRfLearnStatus;
  relayPulseMs: number;
  relayCooldownMs: number;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
}

export interface QrunlockActivityEvent {
  eventId: string;
  deviceId: string;
  type: "unlock" | "rf_learn_start" | "rf_learn_cancel" | "rf_learn_timeout";
  source: string;
  occurredAt: string;
  detail?: string;
}

export interface QrunlockSettings {
  deviceId: string;
  relayPulseMs: number;
  relayCooldownMs: number;
  relayStateAfterPowerRestore: RelayPowerRestoreMode;
  switchType: SwitchType;
  updatedAt: string;
}

export interface RfRemoteRecord {
  remoteId: string;
  deviceId: string;
  name: string;
  pairedAt: string;
}

export interface RfLearnState {
  deviceId: string;
  status: QrunlockRfLearnStatus;
  startedAt: string | null;
  updatedAt: string;
}

export interface UnlockResult {
  deviceId: string;
  status: "requested";
  dispatchedAt: string;
  cooldownMs: number;
}

function getCurrentHome(session: AuthSession) {
  return getSelectedHome(
    ensureDefaultHome(session.homes, session.user.userId),
    session.user.userId,
    session.activeHomeId
  );
}

function authedGet<T>(session: AuthSession, path: string): Promise<T> {
  const homeId = getCurrentHome(session).homeId;
  return fetchAuthenticatedJson<T>(path, session, {
    method: "GET",
    headers: createAuthenticatedHeaders(session, { homeId })
  });
}

function authedWrite<T>(
  session: AuthSession,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const homeId = getCurrentHome(session).homeId;
  return fetchAuthenticatedJson<T>(path, session, {
    method,
    headers: createAuthenticatedHeaders(session, { contentType: "application/json", homeId }),
    body: JSON.stringify(body ?? {})
  });
}

export function listQrunlockDevices(session: AuthSession): Promise<QrunlockDeviceSummary[]> {
  return authedGet(session, `${qrunlockEndpoint}/devices`);
}

export function getQrunlockDevice(session: AuthSession, deviceId: string): Promise<QrunlockDeviceSummary> {
  return authedGet(session, `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}`);
}

export function unlockDevice(
  session: AuthSession,
  deviceId: string,
  input?: { reason?: string; requestId?: string }
): Promise<UnlockResult> {
  return authedWrite(
    session,
    "POST",
    `${deviceActionEndpoint}/${encodeURIComponent(deviceId)}/qrunlock/unlock`,
    input
  );
}

export function startRfLearning(session: AuthSession, deviceId: string): Promise<RfLearnState> {
  return authedWrite(
    session,
    "POST",
    `${deviceActionEndpoint}/${encodeURIComponent(deviceId)}/qrunlock/rf-learning/start`
  );
}

export function cancelRfLearning(session: AuthSession, deviceId: string): Promise<RfLearnState> {
  return authedWrite(
    session,
    "POST",
    `${deviceActionEndpoint}/${encodeURIComponent(deviceId)}/qrunlock/rf-learning/cancel`
  );
}

export function getRfLearnStatus(session: AuthSession, deviceId: string): Promise<RfLearnState> {
  return authedGet(
    session,
    `${deviceActionEndpoint}/${encodeURIComponent(deviceId)}/qrunlock/rf-learning/status`
  );
}

export function getSettings(session: AuthSession, deviceId: string): Promise<QrunlockSettings> {
  return authedGet(session, `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/settings`);
}

export function updateSettings(
  session: AuthSession,
  deviceId: string,
  patch: Partial<Pick<QrunlockSettings, "relayCooldownMs" | "relayStateAfterPowerRestore" | "switchType">>
): Promise<QrunlockSettings> {
  return authedWrite(
    session,
    "PUT",
    `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/settings`,
    patch
  );
}

export function listActivity(session: AuthSession, deviceId: string): Promise<QrunlockActivityEvent[]> {
  return authedGet(session, `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/activity`);
}

export function listRfRemotes(session: AuthSession, deviceId: string): Promise<RfRemoteRecord[]> {
  return authedGet(session, `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/rf-remotes`);
}

export function addRfRemote(
  session: AuthSession,
  deviceId: string,
  name?: string
): Promise<RfRemoteRecord> {
  return authedWrite(
    session,
    "POST",
    `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/rf-remotes`,
    name ? { name } : {}
  );
}

export function renameRfRemote(
  session: AuthSession,
  deviceId: string,
  remoteId: string,
  name: string
): Promise<RfRemoteRecord> {
  return authedWrite(
    session,
    "PATCH",
    `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/rf-remotes/${encodeURIComponent(remoteId)}`,
    { name }
  );
}

export function deleteRfRemote(
  session: AuthSession,
  deviceId: string,
  remoteId: string
): Promise<{ remoteId: string }> {
  return authedWrite(
    session,
    "DELETE",
    `${qrunlockEndpoint}/devices/${encodeURIComponent(deviceId)}/rf-remotes/${encodeURIComponent(remoteId)}`
  );
}

// Generic platform rename — not a QRunlock-specific endpoint, reused as-is
// (VPS/apps/api-server/src/modules/devices/device.routes.ts: POST
// /:deviceId/rename). Renaming a device is a platform concept, not
// something this plugin should reimplement.
export function renameDevice(
  session: AuthSession,
  deviceId: string,
  displayName: string
): Promise<DeviceRecord> {
  return authedWrite(session, "POST", `${deviceActionEndpoint}/${encodeURIComponent(deviceId)}/rename`, {
    displayName
  });
}
