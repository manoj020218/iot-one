import { describe, expect, it } from "vitest";

import {
  getInitialProvisioningStatus,
  getProvisioningSequence
} from "./provisioningStateMachine";

describe("provisioning state machine", () => {
  it("returns the BLE progression sequence", () => {
    expect(getInitialProvisioningStatus("ble")).toBe("BLE_CONNECTED");
    expect(getProvisioningSequence("ble")).toContain("DEVICE_REGISTERED");
  });

  it("returns the AP progression sequence", () => {
    expect(getInitialProvisioningStatus("ap")).toBe("WIFI_SENT");
    expect(getProvisioningSequence("ap")).not.toContain("BLE_CONNECTED");
  });
});
