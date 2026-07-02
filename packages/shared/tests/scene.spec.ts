import { describe, expect, it } from "vitest";

import { evaluateSceneCondition, isRestrictedSceneCommand } from "../src/index";

describe("scene helpers", () => {
  it("identifies restricted scene commands", () => {
    expect(isRestrictedSceneCommand("factory_reset")).toBe(true);
    expect(isRestrictedSceneCommand("matter_commission")).toBe(true);
    expect(isRestrictedSceneCommand("refresh")).toBe(false);
  });

  it("evaluates numeric scene conditions", () => {
    expect(evaluateSceneCondition(83, "gte", 80)).toBe(true);
    expect(evaluateSceneCondition(19, "gt", 40)).toBe(false);
  });

  it("evaluates equality-based scene conditions", () => {
    expect(evaluateSceneCondition("online", "eq", "online")).toBe(true);
    expect(evaluateSceneCondition(true, "neq", false)).toBe(true);
  });
});
