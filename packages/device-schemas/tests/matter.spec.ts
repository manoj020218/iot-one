import { describe, expect, it } from "vitest";

import { foundationPidBlueprint, foundationPidRecord, isMatterMode } from "../src/index";

describe("device schema foundation", () => {
  it("keeps the base PID record valid", () => {
    expect(foundationPidRecord.pid).toBe("JNX-TG-C3-001");
    expect(foundationPidBlueprint.hardware.hasBle).toBe(true);
    expect(isMatterMode("NATIVE_MATTER")).toBe(true);
    expect(isMatterMode("unsupported-mode")).toBe(false);
  });
});
