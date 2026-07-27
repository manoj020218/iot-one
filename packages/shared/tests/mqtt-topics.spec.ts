import { describe, expect, it } from "vitest";

import {
  buildDeviceTopic,
  buildDeviceTopicWildcard,
  parseDeviceTopic
} from "../src/index";

const address = { tenantId: "home-1", pid: "PD-RFNC-01", deviceId: "JNX-RFNC-04C8" };

describe("device MQTT topic scheme", () => {
  it("builds a canonical single-segment suffix topic", () => {
    expect(buildDeviceTopic(address, "telemetry")).toBe(
      "jnx/home-1/PD-RFNC-01/JNX-RFNC-04C8/telemetry"
    );
  });

  it("builds a canonical multi-segment suffix topic", () => {
    expect(buildDeviceTopic(address, "cmd/ack")).toBe(
      "jnx/home-1/PD-RFNC-01/JNX-RFNC-04C8/cmd/ack"
    );
  });

  it("builds a wildcard subscription topic for a suffix", () => {
    expect(buildDeviceTopicWildcard("events")).toBe("jnx/+/+/+/events");
    expect(buildDeviceTopicWildcard("ota/ack")).toBe("jnx/+/+/+/ota/ack");
  });

  it("parses a canonical topic back into its address and suffix", () => {
    expect(parseDeviceTopic("jnx/home-1/PD-RFNC-01/JNX-RFNC-04C8/telemetry")).toEqual({
      tenantId: "home-1",
      pid: "PD-RFNC-01",
      deviceId: "JNX-RFNC-04C8",
      suffix: "telemetry"
    });
  });

  it("parses a multi-segment suffix topic", () => {
    expect(parseDeviceTopic("jnx/home-1/PD-RFNC-01/JNX-RFNC-04C8/cmd/ack")).toEqual({
      tenantId: "home-1",
      pid: "PD-RFNC-01",
      deviceId: "JNX-RFNC-04C8",
      suffix: "cmd/ack"
    });
  });

  it("round-trips build -> parse for every known suffix", () => {
    for (const suffix of [
      "telemetry",
      "status",
      "events",
      "cmd",
      "cmd/ack",
      "ota",
      "ota/ack",
      "lwt"
    ] as const) {
      const topic = buildDeviceTopic(address, suffix);
      expect(parseDeviceTopic(topic)).toEqual({ ...address, suffix });
    }
  });

  it("rejects topics with the wrong prefix", () => {
    expect(
      parseDeviceTopic("jenix/runtime/telemetry")
    ).toBeUndefined();
  });

  it("rejects topics with an unknown suffix", () => {
    expect(
      parseDeviceTopic("jnx/home-1/PD-RFNC-01/JNX-RFNC-04C8/not-a-real-suffix")
    ).toBeUndefined();
  });

  it("rejects topics missing address segments", () => {
    expect(parseDeviceTopic("jnx/home-1/telemetry")).toBeUndefined();
  });
});
