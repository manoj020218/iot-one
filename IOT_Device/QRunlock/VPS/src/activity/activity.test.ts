import type { DeviceRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { QRUNLOCK_PID } from "../constants";
import { unlockDevice } from "../lock/lock.service";
import { resetLockStore } from "../lock/lock.model";
import type { QrunlockPlatformDeps } from "../platform-deps";
import { cancelRfLearning, startRfLearning } from "../rf-learning/rf-learning.service";
import { resetRfLearningStore } from "../rf-learning/rf-learning.model";
import { resetSettingsStore } from "../settings/settings.model";
import { resetActivityStore } from "./activity.model";
import { listActivity } from "./activity.service";
import { QrunlockActivityError } from "./activity.types";

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

function makeDeps(devices: DeviceRecord[]): QrunlockPlatformDeps {
  return {
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
    dispatchDeviceUiCommand: async () => ({
      commandId: "CMD-1",
      deviceId: "JNX-QRU-C3-0001",
      status: "queued" as const,
      queuedAt: new Date().toISOString()
    })
  };
}

describe("activity module", () => {
  beforeEach(async () => {
    await resetLockStore();
    await resetRfLearningStore();
    await resetSettingsStore();
    await resetActivityStore();
  });

  it("records an unlock, then an rf-learn start/cancel, newest first", async () => {
    const deps = makeDeps([makeDevice()]);

    await unlockDevice(deps, "JNX-QRU-C3-0001", {}, { reason: "app" }, "app");
    await startRfLearning(deps, "JNX-QRU-C3-0001", {});
    await cancelRfLearning(deps, "JNX-QRU-C3-0001", {});

    const events = await listActivity(deps, "JNX-QRU-C3-0001", {});

    expect(events.map((e) => e.type)).toEqual(["rf_learn_cancel", "rf_learn_start", "unlock"]);
    expect(events[2]?.detail).toBe("app");
  });

  it("rejects a device that isn't a QRunlock PID", async () => {
    const deps = makeDeps([makeDevice({ deviceId: "OTHER-1", pid: "OTHER-PID" })]);

    await expect(listActivity(deps, "OTHER-1", {})).rejects.toBeInstanceOf(QrunlockActivityError);
  });
});
