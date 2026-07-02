import { describe, expect, it } from "vitest";

import { createAuditStamp, platformIdentity } from "../src/index";

describe("createAuditStamp", () => {
  it("returns an ISO timestamp and keeps actor metadata", () => {
    const stamp = createAuditStamp({
      actorId: "user-1",
      action: "pid.created",
      occurredAt: new Date("2026-07-01T00:00:00.000Z")
    });

    expect(stamp).toEqual({
      actorId: "user-1",
      action: "pid.created",
      occurredAt: "2026-07-01T00:00:00.000Z"
    });
    expect(platformIdentity.appName).toBe("Jenix One");
  });
});
