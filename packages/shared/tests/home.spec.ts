import { describe, expect, it } from "vitest";

import {
  canAssignHomeRole,
  canRevokeHomeMember,
  canWriteToHome,
  createDefaultHome,
  ensureDefaultHome,
  getCurrentHome
} from "../src/index";

describe("home helpers", () => {
  it("creates a default HOME record", () => {
    const home = createDefaultHome("user-1", new Date("2026-07-01T00:00:00.000Z"));

    expect(home).toEqual({
      homeId: "home-user-1",
      name: "HOME",
      ownerUserId: "user-1",
      role: "owner",
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

  it("resolves the active HOME when a selected id exists", () => {
    const primaryHome = createDefaultHome(
      "user-4",
      new Date("2026-07-01T00:00:00.000Z")
    );
    const sharedHome = {
      ...createDefaultHome("owner-5", new Date("2026-07-01T00:00:00.000Z")),
      homeId: "home-shared",
      name: "Shared HOME",
      ownerUserId: "owner-5",
      role: "admin" as const,
      isDefault: false
    };

    expect(
      getCurrentHome([primaryHome, sharedHome], "user-4", "home-shared")
    ).toEqual(sharedHome);
  });

  it("enforces role assignment and revoke rules", () => {
    expect(canWriteToHome("viewer")).toBe(false);
    expect(canWriteToHome("member")).toBe(true);
    expect(canAssignHomeRole("owner", "admin")).toBe(true);
    expect(canAssignHomeRole("admin", "admin")).toBe(false);
    expect(canRevokeHomeMember("owner", "member", false)).toBe(true);
    expect(canRevokeHomeMember("admin", "admin", false)).toBe(false);
  });
});
