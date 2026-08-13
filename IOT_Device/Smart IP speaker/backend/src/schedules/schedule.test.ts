import type { DeviceRecord, DeviceUiCommandAckRecord } from "@jenix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { announcementTesting } from "../announcements/announcement.service";
import { audioAssetTesting } from "../audio-assets/audio-asset.service";
import type { IpSpeakerPlatformDeps, IpSpeakerRequestContext } from "../platform-deps";
import { createSpeakerSchedule, executeSpeakerScheduleNow, scheduleTesting } from "./schedule.service";
import { SpeakerScheduleError } from "./schedule.types";

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

describe("executeSpeakerScheduleNow", () => {
  beforeEach(async () => {
    await Promise.all([
      scheduleTesting.reset(),
      announcementTesting.reset(),
      audioAssetTesting.reset()
    ]);
  });

  it("rejects duplicate executionKey reuse for the same schedule", async () => {
    const device = createDevice("SPK-1");
    const deps: IpSpeakerPlatformDeps = {
      requireAuthenticatedUser: () => undefined,
      requireAuthenticatedRequestUser: () => ({ userId: "USER-1" }),
      readHomeIdFromRequest: () => "HOME-1",
      listDevices: async () => [device],
      getDevice: async (deviceId: string, _context: IpSpeakerRequestContext) => {
        if (deviceId !== device.deviceId) {
          throw new Error(`Device not found: ${deviceId}`);
        }
        return device;
      },
      dispatchDeviceUiCommand: async (
        deviceId: string
      ): Promise<DeviceUiCommandAckRecord> => ({
        commandId: `ui-${deviceId}`,
        deviceId,
        status: "queued",
        queuedAt: "2026-08-11T00:00:01.000Z"
      })
    };

    const schedule = await createSpeakerSchedule(
      deps,
      { userId: "USER-1", homeId: "HOME-1" },
      {
        name: "Lunch Bell",
        targetKind: "device",
        targetId: "SPK-1",
        source: { sourceType: "tone", toneKey: "bell" },
        localTime: "12:30",
        daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI"],
        priority: 1
      }
    );

    await executeSpeakerScheduleNow(
      deps,
      schedule.scheduleId,
      { userId: "USER-1", homeId: "HOME-1" },
      { executionKey: "worker-1" }
    );

    await expect(
      executeSpeakerScheduleNow(
        deps,
        schedule.scheduleId,
        { userId: "USER-1", homeId: "HOME-1" },
        { executionKey: "worker-1" }
      )
    ).rejects.toMatchObject({
      statusCode: 409
    });
  });
});
