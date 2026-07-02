import { describe, expect, it } from "vitest";

import capacitorConfig from "../capacitor.config";

describe("android shell config", () => {
  it("keeps the APK shell aligned with the PWA build output", () => {
    expect(capacitorConfig.appName).toBe("Jenix One");
    expect(capacitorConfig.webDir).toBe("../web-pwa/dist");
  });
});
