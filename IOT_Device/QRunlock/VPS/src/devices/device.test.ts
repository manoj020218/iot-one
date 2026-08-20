import type { DeviceRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { QRUNLOCK_FIXED_RELAY_PULSE_MS, QRUNLOCK_PID } from "../constants";
import { resetLockStore } from "../lock/lock.model";
import type { QrunlockPlatformDeps } from "../platform-deps";
import { resetRfLearningStore } from "../rf-learning/rf-learning.model";
import { resetSettingsStore } from "../settings/settings.model";
import { getQrunlockDevice, listQrunlockDevices } from "./device.service";
import { QrunlockDeviceError } from "./device.types";

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
    dispatchDeviceUiCommand: async () => {
      throw new Error("not used in this test");
    }
  };
}

describe("listQrunlockDevices", () => {
  beforeEach(async () => {
    await resetLockStore();
    await resetRfLearningStore();
    await resetSettingsStore();
  });

  it("filters to only QRunlock PID devices", async () => {
    const devices = [
      makeDevice({ deviceId: "JNX-QRU-C3-0001" }),
      makeDevice({ deviceId: "JNX-TG-C3-001", pid: "JNX-TG-C3-001" })
    ];
    const deps = makeDeps(devices);

    const result = await listQrunlockDevices(deps, {});

    expect(result).toHaveLength(1);
    expect(result[0]?.deviceId).toBe("JNX-QRU-C3-0001");
  });

  it("derives online status from mqttStatus and reports firmware-fixed relayPulseMs by default", async () => {
    const devices = [makeDevice({ mqttStatus: "offline" })];
    const deps = makeDeps(devices);

    const result = await listQrunlockDevices(deps, {});

    expect(result[0]?.onlineStatus).toBe("offline");
    expect(result[0]?.relayPulseMs).toBe(QRUNLOCK_FIXED_RELAY_PULSE_MS);
    expect(result[0]?.rfLearnStatus).toBe("idle");
  });
});

describe("getQrunlockDevice", () => {
  beforeEach(async () => {
    await resetLockStore();
    await resetRfLearningStore();
    await resetSettingsStore();
  });

  it("rejects a device that isn't a QRunlock PID", async () => {
    const devices = [makeDevice({ deviceId: "OTHER-1", pid: "JNX-TG-C3-001" })];
    const deps = makeDeps(devices);

    await expect(getQrunlockDevice(deps, "OTHER-1", {})).rejects.toBeInstanceOf(QrunlockDeviceError);
  });

  it("returns the device summary for a valid QRunlock device", async () => {
    const devices = [makeDevice()];
    const deps = makeDeps(devices);

    const result = await getQrunlockDevice(deps, "JNX-QRU-C3-0001", {});

    expect(result.friendlyName).toBe("Front Door Lock");
  });
});
