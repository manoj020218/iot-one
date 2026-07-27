/**
 * Canonical device MQTT topic scheme (frozen — see MQTT_LICENSED_DEVICE_ACCESS_PLAN.md
 * and the "freeze MQTT onboarding" decision).
 *
 * Shape: jnx/{tenantId}/{pid}/{deviceId}/{suffix}
 *
 * Only what fills the placeholders is ever expected to change (tenantId today always
 * equals the owning HOME's id; later it may point to a vendor/OEM tenant instead).
 * The suffix set is fixed and small on purpose — device-specific structured data rides
 * inside the JSON payload of telemetry/events/status, never as new topic segments.
 */

const topicPrefix = "jnx";

export const deviceTopicSuffixes = [
  "telemetry",
  "status",
  "events",
  "cmd",
  "cmd/ack",
  "ota",
  "ota/ack",
  "lwt"
] as const;

export type DeviceTopicSuffix = (typeof deviceTopicSuffixes)[number];

export interface DeviceTopicAddress {
  tenantId: string;
  pid: string;
  deviceId: string;
}

export interface ParsedDeviceTopic extends DeviceTopicAddress {
  suffix: DeviceTopicSuffix;
}

export function buildDeviceTopic(
  address: DeviceTopicAddress,
  suffix: DeviceTopicSuffix
): string {
  return [topicPrefix, address.tenantId, address.pid, address.deviceId, suffix].join("/");
}

/** Broker-side wildcard subscription for every device on a given suffix. */
export function buildDeviceTopicWildcard(suffix: DeviceTopicSuffix): string {
  return [topicPrefix, "+", "+", "+", suffix].join("/");
}

export function parseDeviceTopic(topic: string): ParsedDeviceTopic | undefined {
  const segments = topic.split("/").filter((segment) => segment.length > 0);

  if (segments.length < 5) {
    return undefined;
  }

  const [prefix, tenantId, pid, deviceId, ...suffixSegments] = segments;

  if (prefix !== topicPrefix || !tenantId || !pid || !deviceId) {
    return undefined;
  }

  const suffix = suffixSegments.join("/");

  if (!(deviceTopicSuffixes as readonly string[]).includes(suffix)) {
    return undefined;
  }

  return { tenantId, pid, deviceId, suffix: suffix as DeviceTopicSuffix };
}
