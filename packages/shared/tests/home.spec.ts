import { describe, expect, it } from "vitest";

import { createDefaultHome, ensureDefaultHome } from "../src/index";

describe("home helpers", () => {
  it("creates a default HOME record", () => {
    const home = createDefaultHome("user-1", new Date("2026-07-01T00:00:00.000Z"));

    expect(home).toEqual({
      homeId: "home-user-1",
      name: "HOME",
      ownerUserId: "user-1",
      isDefault: true,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    });
  });

  it("adds a default HOME only when missing", () => {
    expect(ensureDefaultHome([], "user-2")).toHaveLength(1);

    const existing = createDefaultHome("user-3", new Date("2026-07-01T00:00:00.000Z"));
    expect(ensureDefaultHome([existing], "user-3")).toEqual([existing]);
  });
});
