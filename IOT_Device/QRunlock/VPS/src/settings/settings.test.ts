import type { DeviceRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { QRUNLOCK_FIXED_RELAY_PULSE_MS, QRUNLOCK_PID } from "../constants";
import type { QrunlockPlatformDeps } from "../platform-deps";
import { resetSettingsStore } from "./settings.model";
import { getSettings, updateSettings } from "./settings.service";
import { QrunlockSettingsError } from "./settings.types";

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
      status: "queued",
      queuedAt: new Date().toISOString()
    })
  };
}

describe("settings module", () => {
  beforeEach(async () => {
    await resetSettingsStore();
  });

  it("returns the fixed relayPulseMs and the firmware default relayCooldownMs before any update", async () => {
    const deps = makeDeps([makeDevice()]);

    const settings = await getSettings(deps, "JNX-QRU-C3-0001", {});

    expect(settings.relayPulseMs).toBe(QRUNLOCK_FIXED_RELAY_PULSE_MS);
    expect(settings.relayCooldownMs).toBe(1500);
    expect(settings.relayStateAfterPowerRestore).toBe("remember");
    expect(settings.switchType).toBe("reset");
  });

  it("updates relayCooldownMs but never lets relayPulseMs move off the firmware-fixed value", async () => {
    const deps = makeDeps([makeDevice()]);

    const settings = await updateSettings(deps, "JNX-QRU-C3-0001", {}, { relayCooldownMs: 4000 });

    expect(settings.relayCooldownMs).toBe(4000);
    expect(settings.relayPulseMs).toBe(QRUNLOCK_FIXED_RELAY_PULSE_MS);
  });

  it("updates relayStateAfterPowerRestore and switchType independently, leaving the other fields untouched", async () => {
    const deps = makeDeps([makeDevice()]);
    await updateSettings(deps, "JNX-QRU-C3-0001", {}, { relayCooldownMs: 2500 });

    const settings = await updateSettings(
      deps,
      "JNX-QRU-C3-0001",
      {},
      { relayStateAfterPowerRestore: "on", switchType: "toggle" }
    );

    expect(settings.relayStateAfterPowerRestore).toBe("on");
    expect(settings.switchType).toBe("toggle");
    expect(settings.relayCooldownMs).toBe(2500);
  });

  it("rejects a device that isn't a QRunlock PID", async () => {
    const deps = makeDeps([makeDevice({ deviceId: "OTHER-1", pid: "OTHER-PID" })]);

    await expect(getSettings(deps, "OTHER-1", {})).rejects.toBeInstanceOf(QrunlockSettingsError);
  });
});
