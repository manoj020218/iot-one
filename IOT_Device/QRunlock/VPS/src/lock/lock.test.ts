import type { DeviceRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetActivityStore } from "../activity/activity.model";
import { listActivity } from "../activity/activity.service";
import { QRUNLOCK_PID } from "../constants";
import type { QrunlockPlatformDeps } from "../platform-deps";
import { resetSettingsStore, settingsRepository } from "../settings/settings.model";
import { resetLockStore } from "./lock.model";
import { unlockDevice } from "./lock.service";
import { QrunlockLockError } from "./lock.types";

function makeDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    deviceId: "JNX-QRU-C3-0001",
    pid: QRUNLOCK_PID,
    homeId: "HOME-1",
    tenantId: "HOME-1",
    ownerUserId: "USER-1",
    displayName: "Front Door Lock",
    mqttStatus: "online",
    cloudStatus: "online",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides
  };
}

function makeDeps(devices: DeviceRecord[]) {
  const dispatchDeviceUiCommand = vi.fn(async () => ({
    commandId: "CMD-1",
    deviceId: "JNX-QRU-C3-0001",
    status: "queued" as const,
    queuedAt: new Date().toISOString()
  }));

  const deps: QrunlockPlatformDeps = {
    requireAuthenticatedUser: (_request, _response, next) => next(),
    requireAuthenticatedRequestUser: () => ({ userId: "USER-1" }),
    readHomeIdFromRequest: () => "HOME-1",
    listDevices: async () => devices,
    getDevice: async (deviceId) => {
      const found = devices.find((device) => device.deviceId === deviceId);
      if (!found) {
        throw new Error(`not found: ${deviceId}`);
      }
      return found;
    },
    dispatchDeviceUiCommand
  };

  return { deps, dispatchDeviceUiCommand };
}

describe("unlockDevice", () => {
  beforeEach(async () => {
    await resetLockStore();
    await resetSettingsStore();
    await resetActivityStore();
  });

  it("dispatches an unlock command and records the dispatch", async () => {
    const { deps, dispatchDeviceUiCommand } = makeDeps([makeDevice()]);

    const result = await unlockDevice(deps, "JNX-QRU-C3-0001", {}, { reason: "app" }, "app");

    expect(result.status).toBe("requested");
    expect(dispatchDeviceUiCommand).toHaveBeenCalledWith(
      "JNX-QRU-C3-0001",
      { command: "unlock", payload: { reason: "app" }, requiresAck: true },
      {}
    );
  });

  it("rejects a second unlock within the relay cooldown window", async () => {
    const { deps } = makeDeps([makeDevice()]);
    await settingsRepository.save("JNX-QRU-C3-0001", { relayCooldownMs: 5000 });

    await unlockDevice(deps, "JNX-QRU-C3-0001", {}, {}, "app");

    await expect(unlockDevice(deps, "JNX-QRU-C3-0001", {}, {}, "app")).rejects.toMatchObject({
      code: "UNLOCK_COOLDOWN_ACTIVE"
    });
  });

  it("returns the original dispatch for a repeated requestId instead of pulsing twice", async () => {
    const { deps, dispatchDeviceUiCommand } = makeDeps([makeDevice()]);

    const first = await unlockDevice(deps, "JNX-QRU-C3-0001", {}, { requestId: "REQ-ABC" }, "app");
    const second = await unlockDevice(deps, "JNX-QRU-C3-0001", {}, { requestId: "REQ-ABC" }, "app");

    expect(second.dispatchedAt).toBe(first.dispatchedAt);
    expect(dispatchDeviceUiCommand).toHaveBeenCalledTimes(1);
  });

  it("rejects a device that isn't a QRunlock PID", async () => {
    const { deps } = makeDeps([makeDevice({ deviceId: "OTHER-1", pid: "OTHER-PID" })]);

    await expect(unlockDevice(deps, "OTHER-1", {}, {}, "app")).rejects.toBeInstanceOf(QrunlockLockError);
  });

  it("records whichever caller triggered the unlock in the activity log, not an inferred value", async () => {
    const { deps } = makeDeps([makeDevice()]);

    await unlockDevice(deps, "JNX-QRU-C3-0001", {}, {}, "api:qrunlock-video-call");

    const events = await listActivity(deps, "JNX-QRU-C3-0001", {});
    expect(events[0]?.source).toBe("api:qrunlock-video-call");
  });
});
