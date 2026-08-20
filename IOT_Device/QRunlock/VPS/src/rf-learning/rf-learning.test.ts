import type { DeviceRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetActivityStore } from "../activity/activity.model";
import { QRUNLOCK_PID } from "../constants";
import type { QrunlockPlatformDeps } from "../platform-deps";
import { resetRfLearningStore } from "./rf-learning.model";
import { cancelRfLearning, getRfLearnState, startRfLearning } from "./rf-learning.service";
import { QrunlockRfLearnError } from "./rf-learning.types";

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

describe("rf-learning module", () => {
  beforeEach(async () => {
    await resetRfLearningStore();
    await resetActivityStore();
  });

  it("starts idle, then learning, then rejects a second start", async () => {
    const { deps } = makeDeps([makeDevice()]);

    expect((await getRfLearnState(deps, "JNX-QRU-C3-0001", {})).status).toBe("idle");

    const started = await startRfLearning(deps, "JNX-QRU-C3-0001", {});
    expect(started.status).toBe("learning");

    await expect(startRfLearning(deps, "JNX-QRU-C3-0001", {})).rejects.toMatchObject({
      code: "RF_LEARN_ALREADY_ACTIVE"
    });
  });

  it("cancels an active RF-learn session", async () => {
    const { deps } = makeDeps([makeDevice()]);
    await startRfLearning(deps, "JNX-QRU-C3-0001", {});

    const cancelled = await cancelRfLearning(deps, "JNX-QRU-C3-0001", {});

    expect(cancelled.status).toBe("cancelled");
  });

  it("rejects cancel when nothing is active", async () => {
    const { deps } = makeDeps([makeDevice()]);

    await expect(cancelRfLearning(deps, "JNX-QRU-C3-0001", {})).rejects.toBeInstanceOf(
      QrunlockRfLearnError
    );
  });
});
