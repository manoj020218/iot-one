import type { DeviceRecord } from "@jenix/shared";
import { describe, expect, it } from "vitest";

import { SMART_STREAMER_PID } from "../constants";
import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { getStreamerDevice, listStreamerDevices } from "./device.service";
import { StreamerDeviceError } from "./device.types";

function makeDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    deviceId: "JNX-P4-000101",
    pid: SMART_STREAMER_PID,
    homeId: "HOME-1",
    tenantId: "HOME-1",
    ownerUserId: "USER-1",
    displayName: "Front Gate Camera",
    mqttStatus: "online",
    cloudStatus: "online",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides
  };
}

function makeDeps(devices: DeviceRecord[]): SmartStreamerPlatformDeps {
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
    },
    createScene: async () => {
      throw new Error("not used in this test");
    },
    patchScene: async () => {
      throw new Error("not used in this test");
    },
    deleteScene: async () => {
      throw new Error("not used in this test");
    },
    listScenes: async () => {
      throw new Error("not used in this test");
    },
    runSceneManually: async () => {
      throw new Error("not used in this test");
    }
  };
}

describe("listStreamerDevices", () => {
  it("filters to only Smart Streamer PID devices", async () => {
    const devices = [
      makeDevice({ deviceId: "JNX-P4-000101" }),
      makeDevice({ deviceId: "JNX-TG-C3-001", pid: "JNX-TG-C3-001" })
    ];
    const deps = makeDeps(devices);

    const result = await listStreamerDevices(deps, {});

    expect(result).toHaveLength(1);
    expect(result[0]?.deviceId).toBe("JNX-P4-000101");
  });

  it("derives online status from mqttStatus", async () => {
    const devices = [makeDevice({ mqttStatus: "offline" })];
    const deps = makeDeps(devices);

    const result = await listStreamerDevices(deps, {});

    expect(result[0]?.onlineStatus).toBe("offline");
  });
});

describe("getStreamerDevice", () => {
  it("rejects a device that isn't a Smart Streamer PID", async () => {
    const devices = [makeDevice({ deviceId: "OTHER-1", pid: "JNX-TG-C3-001" })];
    const deps = makeDeps(devices);

    await expect(getStreamerDevice(deps, "OTHER-1", {})).rejects.toBeInstanceOf(
      StreamerDeviceError
    );
  });

  it("returns the device summary for a valid Smart Streamer device", async () => {
    const devices = [makeDevice()];
    const deps = makeDeps(devices);

    const result = await getStreamerDevice(deps, "JNX-P4-000101", {});

    expect(result.friendlyName).toBe("Front Gate Camera");
  });
});
