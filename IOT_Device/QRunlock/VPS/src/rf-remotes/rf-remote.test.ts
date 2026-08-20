import type { DeviceRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { QRUNLOCK_PID } from "../constants";
import type { QrunlockPlatformDeps } from "../platform-deps";
import { addRfRemote, deleteRfRemote, listRfRemotes, renameRfRemote } from "./rf-remote.service";
import { resetRfRemoteStore } from "./rf-remote.model";
import { QrunlockRfRemoteError } from "./rf-remote.types";

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

describe("rf-remotes module", () => {
  beforeEach(async () => {
    await resetRfRemoteStore();
  });

  it("adds a remote with an auto-numbered default name", async () => {
    const deps = makeDeps([makeDevice()]);

    const first = await addRfRemote(deps, "JNX-QRU-C3-0001", {}, undefined);
    const second = await addRfRemote(deps, "JNX-QRU-C3-0001", {}, undefined);

    expect(first.name).toBe("Remote 1");
    expect(second.name).toBe("Remote 2");
  });

  it("renames and deletes a remote", async () => {
    const deps = makeDeps([makeDevice()]);
    const remote = await addRfRemote(deps, "JNX-QRU-C3-0001", {}, "Front Gate");

    const renamed = await renameRfRemote(deps, "JNX-QRU-C3-0001", {}, remote.remoteId, "Garage");
    expect(renamed.name).toBe("Garage");

    await deleteRfRemote(deps, "JNX-QRU-C3-0001", {}, remote.remoteId);
    const remaining = await listRfRemotes(deps, "JNX-QRU-C3-0001", {});
    expect(remaining).toHaveLength(0);
  });

  it("rejects renaming a remote that doesn't exist", async () => {
    const deps = makeDeps([makeDevice()]);

    await expect(
      renameRfRemote(deps, "JNX-QRU-C3-0001", {}, "missing-id", "X")
    ).rejects.toBeInstanceOf(QrunlockRfRemoteError);
  });
});
