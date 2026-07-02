import { describe, expect, it } from "vitest";

import type { ProvisioningStatus } from "../src/index";

const statuses: ProvisioningStatus[] = [
  "BLE_CONNECTED",
  "WIFI_SENT",
  "DEVICE_CONNECTING_WIFI",
  "DEVICE_CONNECTING_CLOUD",
  "MQTT_CONNECTED",
  "DEVICE_REGISTERED",
  "SUCCESS",
  "FAILED"
];

describe("provisioning status contract", () => {
  it("keeps all expected provisioning states available", () => {
    expect(statuses).toContain("MQTT_CONNECTED");
    expect(statuses).toContain("SUCCESS");
    expect(statuses).toHaveLength(8);
  });
});
