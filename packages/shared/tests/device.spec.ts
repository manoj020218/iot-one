import { describe, expect, it } from "vitest";

import { createDeviceRecord, renameDeviceRecord } from "../src/index";

describe("device helpers", () => {
  it("creates a normalized device record", () => {
    const record = createDeviceRecord(
      {
        deviceId: "jnx-tg-a7f2",
        pid: "jnx-tg-c3-001",
        homeId: "home-1",
        ownerUserId: "user-1",
        displayName: "Tank Guard A"
      },
      new Date("2026-07-01T00:00:00.000Z")
    );

    expect(record.deviceId).toBe("JNX-TG-A7F2");
    expect(record.pid).toBe("JNX-TG-C3-001");
    expect(record.displayName).toBe("Tank Guard A");
    expect(record.mqttStatus).toBe("unknown");
  });

  it("renames the device and updates the timestamp", () => {
    const original = createDeviceRecord(
      {
        deviceId: "JNX-TG-A7F2",
        pid: "JNX-TG-C3-001",
        homeId: "home-1",
        ownerUserId: "user-1"
      },
      new Date("2026-07-01T00:00:00.000Z")
    );

    const renamed = renameDeviceRecord(
      original,
      "Main Tank",
      new Date("2026-07-01T01:00:00.000Z")
    );

    expect(renamed.displayName).toBe("Main Tank");
    expect(renamed.updatedAt).toBe("2026-07-01T01:00:00.000Z");
  });
});
