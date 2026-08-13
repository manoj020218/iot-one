import type { DeviceRecord, DeviceUiCommandAckRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { announceToTarget, announcementTesting } from "./announcement.service";
import { groupTesting, createSpeakerGroup } from "../groups/group.service";
import { audioAssetTesting } from "../audio-assets/audio-asset.service";
import type { IpSpeakerPlatformDeps, IpSpeakerRequestContext } from "../platform-deps";

function createDevice(deviceId: string): DeviceRecord {
  return {
    deviceId,
    pid: "JNX-IPS-C3-01",
    homeId: "HOME-1",
    tenantId: "HOME-1",
    ownerUserId: "USER-1",
    displayName: deviceId,
    mqttStatus: "online",
    cloudStatus: "online",
    localStatus: "available",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  };
}

describe("announceToTarget", () => {
  beforeEach(async () => {
    await Promise.all([
      announcementTesting.reset(),
      groupTesting.reset(),
      audioAssetTesting.reset()
    ]);
  });

  it("tracks partial group failure per device", async () => {
    const devices = new Map(
      ["SPK-1", "SPK-2"].map((deviceId) => [deviceId, createDevice(deviceId)])
    );
    const deps: IpSpeakerPlatformDeps = {
      requireAuthenticatedUser: () => undefined,
      requireAuthenticatedRequestUser: () => ({ userId: "USER-1" }),
      readHomeIdFromRequest: () => "HOME-1",
      listDevices: async () => [...devices.values()],
      getDevice: async (deviceId: string, _context: IpSpeakerRequestContext) => {
        const device = devices.get(deviceId);
        if (!device) {
          throw new Error(`Device not found: ${deviceId}`);
        }
        return device;
      },
      dispatchDeviceUiCommand: async (
        deviceId: string
      ): Promise<DeviceUiCommandAckRecord> => {
        if (deviceId === "SPK-2") {
          throw new Error("Device offline");
        }

        return {
          commandId: `ui-${deviceId}`,
          deviceId,
          status: "queued",
          queuedAt: "2026-08-11T00:00:01.000Z"
        };
      }
    };

    const group = await createSpeakerGroup(
      deps,
      { userId: "USER-1", homeId: "HOME-1" },
      { name: "All Speakers", deviceIds: ["SPK-1", "SPK-2"] }
    );

    const result = await announceToTarget(
      deps,
      "group",
      group.groupId,
      { userId: "USER-1", homeId: "HOME-1" },
      {
        source: { sourceType: "tone", toneKey: "siren" },
        priority: 2
      }
    );

    expect(result.summary).toEqual({
      targeted: 2,
      accepted: 1,
      failed: 1,
      pendingPlaybackAck: 1
    });
    expect(result.dispatch.deviceResults).toHaveLength(2);
    expect(
      result.dispatch.deviceResults.find((device) => device.deviceId === "SPK-2")?.dispatchStatus
    ).toBe("failed");
  });
});
