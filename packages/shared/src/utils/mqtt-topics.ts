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

/**
 * Legacy per-product-family topic contract — used by already-flashed firmware
 * (Smart RF Transmitter, Tank Guard, and Token Dispenser per the same design
 * intent) that predates the canonical scheme above. See
 * JENIXONE_MQTT_HANDOFF.md and MQTT_LICENSED_DEVICE_ACCESS_PLAN.md.
 *
 * Shape: {topicRoot}/{deviceId}/{suffix}
 *   topicRoot groups one product family (e.g. "jenixone/v1/transmitters",
 *   "jnx/tg"). Each family declares its own suffix vocabulary — the shape is
 *   shared, the suffix set is not (Transmitter's per-action cmd/* topics vs
 *   Tank Guard's telemetry/status/event/alarm/config, for example).
 *
 * New devices use buildDeviceTopic instead — this exists purely as a
 * translation target so already-tested hardware doesn't need reflashing.
 */
export const legacyDeviceTopicSuffixes = [
  "availability",
  "status",
  "meta/commands",
  "evt/ack"
] as const;

export type LegacyDeviceTopicSuffix = (typeof legacyDeviceTopicSuffixes)[number];

export function buildLegacyDeviceTopic(
  topicRoot: string,
  deviceId: string,
  suffix: string
): string {
  return [topicRoot, deviceId, suffix].join("/");
}

/** Command topics are per-action (e.g. "cmd/trigger"), not part of the fixed suffix set. */
export function buildLegacyCommandTopic(
  topicRoot: string,
  deviceId: string,
  actionSuffix: string
): string {
  return buildLegacyDeviceTopic(topicRoot, deviceId, `cmd/${actionSuffix}`);
}

/** Broker-side wildcard subscription for every device on a given product family + suffix. */
export function buildLegacyDeviceTopicWildcard(topicRoot: string, suffix: string): string {
  return [topicRoot, "+", suffix].join("/");
}

export interface ParsedLegacyDeviceTopic {
  topicRoot: string;
  deviceId: string;
  suffix: string;
}

export function parseLegacyDeviceTopic(
  topic: string,
  topicRoot: string
): ParsedLegacyDeviceTopic | undefined {
  const prefix = `${topicRoot}/`;

  if (!topic.startsWith(prefix)) {
    return undefined;
  }

  const segments = topic
    .slice(prefix.length)
    .split("/")
    .filter((segment) => segment.length > 0);

  if (segments.length < 2) {
    return undefined;
  }

  const [deviceId, ...suffixSegments] = segments;

  if (!deviceId) {
    return undefined;
  }

  return { topicRoot, deviceId, suffix: suffixSegments.join("/") };
}
