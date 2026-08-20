import type { DeviceRecord } from "@jenix/shared";

import { QRUNLOCK_PID } from "../constants";
import { lockRepository } from "../lock/lock.model";
import type { DeviceRequestContext, QrunlockPlatformDeps } from "../platform-deps";
import { rfLearningRepository } from "../rf-learning/rf-learning.model";
import { settingsRepository } from "../settings/settings.model";
import { QrunlockDeviceError } from "./device.types";
import type { QrunlockDeviceSummary } from "./device.types";

async function toSummary(device: DeviceRecord): Promise<QrunlockDeviceSummary> {
  const [lockState, rfLearnState, settings] = await Promise.all([
    lockRepository.getState(device.deviceId),
    rfLearningRepository.getState(device.deviceId),
    settingsRepository.get(device.deviceId)
  ]);

  return {
    deviceId: device.deviceId,
    friendlyName: device.displayName,
    onlineStatus: device.mqttStatus === "online" ? "online" : "offline",
    // The relay is a momentary pulse, never a persisted state — see
    // lock/lock.service.ts. "pulsing" is not currently derivable without a
    // real-time telemetry/ack channel from the device, so this is always
    // "idle" until that exists (deliberately not guessed at).
    relayState: "idle",
    lastUnlockAt: lockState?.lastDispatchedAt ?? null,
    lastUnlockReason: lockState?.lastReason ?? null,
    rfLearnStatus: rfLearnState?.status ?? "idle",
    relayPulseMs: settings.relayPulseMs,
    relayCooldownMs: settings.relayCooldownMs,
    firmwareVersion: device.firmwareVersion ?? null,
    lastSeenAt: device.lastSeenAt ?? null
  };
}

export async function listQrunlockDevices(
  deps: QrunlockPlatformDeps,
  context: DeviceRequestContext
): Promise<QrunlockDeviceSummary[]> {
  const devices = await deps.listDevices(context);
  const qrunlockDevices = devices.filter((device) => device.pid === QRUNLOCK_PID);
  return Promise.all(qrunlockDevices.map(toSummary));
}

export async function getQrunlockDevice(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<QrunlockDeviceSummary> {
  const device = await deps.getDevice(deviceId, context);

  if (device.pid !== QRUNLOCK_PID) {
    throw new QrunlockDeviceError(404, `Not a QRunlock device: ${deviceId}`);
  }

  return toSummary(device);
}
