import { activityRepository } from "../activity/activity.model";
import { QRUNLOCK_PID } from "../constants";
import type { DeviceRequestContext, QrunlockPlatformDeps } from "../platform-deps";
import { settingsRepository } from "../settings/settings.model";
import { lockRepository } from "./lock.model";
import type { UnlockInput, UnlockResult } from "./lock.types";
import { QrunlockLockError } from "./lock.types";

async function requireQrunlockDevice(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<void> {
  const device = await deps.getDevice(deviceId, context);
  if (device.pid !== QRUNLOCK_PID) {
    throw new QrunlockLockError(404, "DEVICE_NOT_FOUND", `Not a QRunlock device: ${deviceId}`);
  }
}

/**
 * Mirrors ControlApi::Unlock(reason) in
 * IOT_Device/QRunlock/src/platform/ControlApi.h — a momentary relay
 * pulse (an "inching" trigger), never a held on/off relay state. QRunlock
 * is a RIM-lock power supply (see ProductIdentity.h's kProductLine) —
 * every real unit only ever needs this one action, so this is the only
 * command this module exposes; there is deliberately no on/off pair to
 * design around. The cooldown check below is a server-side courtesy
 * (avoid dispatching a second command while the device's own relay
 * cooldown, config.relayCooldownMs, is still active) — it does not
 * replace the firmware's own cooldown enforcement, which is authoritative.
 *
 * `caller` is set by the calling code path, never by the request body —
 * every route into this function (the PWA's own HTTP controller today,
 * a future vendor/public-API controller for the QRunlock video-call
 * product tomorrow) must go through this exact function so the cooldown
 * guard and activity log apply no matter who triggers it, and must pass
 * its own fixed identifying string (e.g. "app", "api:qrunlock") rather
 * than letting a client claim to be someone else.
 */
export async function unlockDevice(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext,
  input: UnlockInput,
  caller: string
): Promise<UnlockResult> {
  await requireQrunlockDevice(deps, deviceId, context);

  // Idempotent retry: same requestId returns the original dispatch instead
  // of pulsing the relay twice (same convention as Smart Streamer session
  // start — VPS/API_CONTRACT.md §5 there).
  if (input.requestId) {
    const existing = await lockRepository.getByRequestId(input.requestId);
    if (existing) {
      const settings = await settingsRepository.get(deviceId);
      return {
        deviceId,
        status: "requested",
        dispatchedAt: existing.lastDispatchedAt,
        cooldownMs: settings.relayCooldownMs
      };
    }
  }

  const settings = await settingsRepository.get(deviceId);
  const state = await lockRepository.getState(deviceId);

  if (state) {
    const elapsedMs = Date.now() - new Date(state.lastDispatchedAt).getTime();
    if (elapsedMs < settings.relayCooldownMs) {
      throw new QrunlockLockError(
        409,
        "UNLOCK_COOLDOWN_ACTIVE",
        `Relay cooldown still active for ${deviceId}`,
        { retryAfterMs: settings.relayCooldownMs - elapsedMs, cooldownMs: settings.relayCooldownMs }
      );
    }
  }

  const dispatchedAt = new Date().toISOString();
  const reason = input.reason ?? null;

  await deps.dispatchDeviceUiCommand(
    deviceId,
    { command: "unlock", payload: reason ? { reason } : {}, requiresAck: true },
    context
  );

  await lockRepository.recordDispatch(deviceId, dispatchedAt, reason);
  if (input.requestId) {
    await lockRepository.saveRequestId(input.requestId, deviceId);
  }
  await activityRepository.record(deviceId, "unlock", caller, reason ?? undefined);

  return { deviceId, status: "requested", dispatchedAt, cooldownMs: settings.relayCooldownMs };
}
