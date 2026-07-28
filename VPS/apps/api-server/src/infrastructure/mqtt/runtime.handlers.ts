import { applyDeviceTelemetryState } from "../../modules/devices/device.service";
import { deviceUiRuntimeStore } from "../../modules/devices/device-ui-runtime.model";
import { acknowledgeOtaDeliveryFailure, acknowledgeOtaDeliverySuccess } from "../../modules/ota/ota.service";
import {
  enqueuePreparedSceneEvaluationJobs,
  prepareTelemetrySceneEvaluationJob
} from "../../modules/scenes/scene.service";
import { sceneActionDispatchRepository } from "../../modules/scenes/scene.model";
import type { SceneRuntimeQueueResponse } from "../../modules/scenes/scene.types";
import { raiseCall } from "../../modules/nurse-call-receiver/nurse-call-receiver.service";
import {
  defaultSmartRfTopicRoot,
  ingestAck as ingestSmartRfAck,
  ingestAvailability as ingestSmartRfAvailability,
  ingestStatus as ingestSmartRfStatus
} from "../../modules/smart-rf-transmitter/smart-rf-transmitter.service";
import {
  ingestEvent as ingestTokenDispenserEvent,
  ingestState as ingestTokenDispenserState,
  ingestTelemetry as ingestTokenDispenserTelemetry,
  tokenDispenserTopicPrefix
} from "../../modules/token-dispenser/token-dispenser.service";
import {
  ingestCommandAck as ingestP10DisplayCommandAck,
  ingestState as ingestP10DisplayState,
  ingestTelemetry as ingestP10DisplayTelemetry,
  p10DisplayTopicPrefix
} from "../../modules/p10-display/p10-display.service";
import { ingestStatus as ingestSosSirenStatus, sosSirenPid } from "../../modules/sos-siren/sos-siren.service";
import type {
  RuntimeDeviceCommandAckMessage,
  RuntimeDeviceTopicMessage,
  RuntimeLegacyDeviceMessage,
  RuntimeOtaAckMessage,
  RuntimeScheduleTickMessage,
  RuntimeTelemetryIngressMessage
} from "./runtime.types";

/** PIDs that speak the event-driven ("events"/"status" topic) model rather than
 *  flat numeric telemetry. Each entry below fans out to that device module's own
 *  ingestion function — add a case per PID as more event-driven devices onboard. */
const nurseCallReceiverPid = "JNX-RFNC-C3-01";

/**
 * Tank Guard's real firmware (Firmware/Sensor/A02W/HW) publishes on its own
 * fixed family root, jnx/tg/{deviceId}/{suffix} — same shape category as the
 * Transmitter's legacy contract, different root and suffix vocabulary. Unlike
 * the other legacy/raw devices, Tank Guard's telemetry is genuinely
 * scene-relevant (this is the platform's original device_threshold reference
 * device), so it's routed through the same applyDeviceTelemetryState +
 * scene-evaluation-job pipeline real HTTP telemetry ingestion uses, not just
 * the generic device-ui-runtime snapshot store.
 */
export const tankGuardLegacyTopicRoot = "jnx/tg";
export const tankGuardLegacyTopicSuffixes = [
  "telemetry",
  "status",
  "event",
  "alarm",
  "config"
] as const;

function readPrimitiveRecord(payload: unknown): Record<string, boolean | number | string> {
  if (!isRecord(payload)) {
    return {};
  }

  const result: Record<string, boolean | number | string> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      result[key] = value;
    }
  }

  return result;
}

async function handleTankGuardTelemetry(
  deviceId: string,
  payload: unknown
): Promise<void> {
  const telemetry = readPrimitiveRecord(payload);
  const occurredAt = new Date().toISOString();

  let savedDevice;
  try {
    savedDevice = await applyDeviceTelemetryState(deviceId, { telemetry, occurredAt });
  } catch {
    // Device not registered yet — nothing to attach telemetry/scenes to.
    return;
  }

  const job = await prepareTelemetrySceneEvaluationJob(
    { deviceId, telemetry, occurredAt },
    { homeId: savedDevice.homeId }
  );
  await enqueuePreparedSceneEvaluationJobs([job]);
}

/** Legacy per-product-family topic roots (see JENIXONE_MQTT_HANDOFF.md). Each
 *  entry fans out to that device family's own ingestion functions — add a case
 *  per topicRoot as more devices with a fixed-family-root contract onboard. */
const legacyTopicRootHandlers: Record<
  string,
  (deviceId: string, suffix: string, payload: unknown) => Promise<void>
> = {
  [defaultSmartRfTopicRoot]: async (deviceId, suffix, payload) => {
    if (suffix === "availability") {
      await ingestSmartRfAvailability(
        deviceId,
        payload === "online" ? "online" : "offline"
      );
      return;
    }

    if (suffix === "status" && isRecord(payload)) {
      await ingestSmartRfStatus(deviceId, payload);
      return;
    }

    if (suffix === "evt/ack" && isRecord(payload)) {
      await ingestSmartRfAck(deviceId, payload);
    }
  },
  [tankGuardLegacyTopicRoot]: async (deviceId, suffix, payload) => {
    if (suffix === "telemetry" || suffix === "status") {
      await handleTankGuardTelemetry(deviceId, payload);
    }
    // event/alarm/config: accepted but not yet acted on — Tank Guard's
    // telemetry payload already carries alarm_active/alarm_code/alarm_message,
    // so nothing is lost; a dedicated event log is a documented follow-up.
  }
};

/**
 * Token Dispenser's real firmware uses a per-device topic shape
 * (jenix/{tenantId}/{siteId}/{deviceId}/{suffix}) where tenantId/siteId vary
 * per device rather than being a fixed family root, so it can't be matched by
 * legacyTopicRootHandlers above — it's routed through the bridge's generic raw
 * passthrough instead and parsed here.
 */
const tokenDispenserTopicPattern = new RegExp(
  `^${tokenDispenserTopicPrefix}\\/[^/]+\\/[^/]+\\/([^/]+)\\/(telemetry|state|event)$`
);

/**
 * P10 Token Display's real firmware uses jenix/v1/{homeId}/{deviceId}/{suffix}
 * (see BuildTopics() in mqtt_client.cpp) — homeId varies per device just like
 * Token Dispenser's tenantId/siteId, so this also goes through the generic
 * raw passthrough rather than legacyTopicRootHandlers. Unlike Token
 * Dispenser's firmware-local labels, this homeId is literally the platform
 * homeId, so no separate connection-config lookup is needed.
 */
const p10DisplayTopicPrefixEscaped = p10DisplayTopicPrefix.replace(/\//g, "\\/");
const p10DisplayTopicPattern = new RegExp(
  `^${p10DisplayTopicPrefixEscaped}\\/[^/]+\\/([^/]+)\\/(telemetry|state|command\\/ack)$`
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  payload: Record<string, unknown>,
  key: string
): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readTelemetryValue(
  payload: Record<string, unknown>,
  key: string
): boolean | number | string | undefined {
  const value = payload[key];
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string"
    ? value
    : undefined;
}

export async function handleRuntimeTelemetryIngressMessage(
  message: RuntimeTelemetryIngressMessage
): Promise<SceneRuntimeQueueResponse> {
  await applyDeviceTelemetryState(message.job.deviceId ?? "", {
    telemetry: message.job.telemetry ?? {},
    occurredAt: message.job.occurredAt,
    ...(message.mqttStatus ? { mqttStatus: message.mqttStatus } : {}),
    ...(message.cloudStatus ? { cloudStatus: message.cloudStatus } : {}),
    ...(message.localStatus ? { localStatus: message.localStatus } : {})
  });

  return enqueuePreparedSceneEvaluationJobs([message.job]);
}

export async function handleRuntimeScheduleTickMessage(
  message: RuntimeScheduleTickMessage
): Promise<SceneRuntimeQueueResponse> {
  return enqueuePreparedSceneEvaluationJobs([message.job]);
}

export async function handleRuntimeDeviceCommandAckMessage(
  message: RuntimeDeviceCommandAckMessage
): Promise<void> {
  await deviceUiRuntimeStore.saveLastCommand(message.deviceId, {
    commandId: message.deliveryId,
    deviceId: message.deviceId,
    status: message.status,
    queuedAt: message.acknowledgedAt,
    acknowledgedAt: message.acknowledgedAt,
    ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
    ...(message.payload ? { payload: message.payload } : {})
  });

  if (message.status === "completed") {
    await sceneActionDispatchRepository.complete(
      message.deliveryId,
      message.acknowledgedAt,
      message.acknowledgedAt
    );
    return;
  }

  await sceneActionDispatchRepository.fail(
    message.deliveryId,
    message.acknowledgedAt,
    message.errorMessage ?? "Device command delivery failed"
  );
}

export async function handleRuntimeOtaAckMessage(
  message: RuntimeOtaAckMessage
): Promise<void> {
  if (message.status === "completed") {
    await acknowledgeOtaDeliverySuccess(
      message.requestId,
      message.acknowledgedAt,
      message.appliedVersion
    );
    return;
  }

  await acknowledgeOtaDeliveryFailure(
    message.requestId,
    message.acknowledgedAt,
    message.errorMessage ?? "OTA delivery failed"
  );
}

export async function handleRuntimeDeviceEventsMessage(
  message: RuntimeDeviceTopicMessage
): Promise<void> {
  if (message.pid !== nurseCallReceiverPid) {
    return;
  }

  const eventType = readStringField(message.payload, "eventType");

  if (eventType !== "call_raised" && eventType !== "call_repeated") {
    return;
  }

  const remoteId = readStringField(message.payload, "remoteSlot");
  const remoteName = readStringField(message.payload, "remoteName");
  const bedLabel = readStringField(message.payload, "bedId");

  await raiseCall(message.deviceId, {
    occurredAt: new Date().toISOString(),
    ...(remoteId ? { remoteId } : {}),
    ...(remoteName ? { remoteName } : {}),
    ...(bedLabel ? { bedLabel } : {})
  });
}

async function handleNurseCallReceiverStatus(message: RuntimeDeviceTopicMessage): Promise<void> {
  const telemetry: Record<string, boolean | number | string> = {};

  for (const key of [
    "pairedRemotes",
    "activeCalls",
    "mode",
    "wifiConnected",
    "mqttConnected",
    "espNowStatus"
  ]) {
    const value = readTelemetryValue(message.payload, key);

    if (value !== undefined) {
      telemetry[key] = value;
    }
  }

  await deviceUiRuntimeStore.saveTelemetry({
    deviceId: message.deviceId,
    pid: message.pid,
    occurredAt: new Date().toISOString(),
    telemetry
  });
}

/** Canonical-scheme devices' `status` handlers, keyed by PID — same
 *  generalize-on-second-caller pattern as legacyTopicRootHandlers. */
const canonicalStatusHandlersByPid: Record<
  string,
  (message: RuntimeDeviceTopicMessage) => Promise<void>
> = {
  [nurseCallReceiverPid]: handleNurseCallReceiverStatus,
  [sosSirenPid]: async (message) => {
    await ingestSosSirenStatus(message.deviceId, message.payload);
  }
};

export async function handleRuntimeDeviceStatusMessage(
  message: RuntimeDeviceTopicMessage
): Promise<void> {
  const handler = canonicalStatusHandlersByPid[message.pid];

  if (!handler) {
    return;
  }

  await handler(message);
}

export async function handleRuntimeLegacyDeviceMessage(
  message: RuntimeLegacyDeviceMessage
): Promise<void> {
  const handler = legacyTopicRootHandlers[message.topicRoot];

  if (!handler) {
    return;
  }

  await handler(message.deviceId, message.suffix, message.payload);
}

export async function handleRuntimeRawMessage(
  topic: string,
  payload: Buffer
): Promise<void> {
  // P10 Display's pattern requires a literal "v1" second segment, so it's
  // strictly more specific than Token Dispenser's wildcard-tenant shape —
  // it must be tried first, or a Token Dispenser mqttTenantId that happens
  // to equal "v1" would collide with this device family (and vice versa,
  // any other Token Dispenser topic falls through safely since it won't
  // match the literal "v1" segment).
  const p10DisplayMatch = p10DisplayTopicPattern.exec(topic);

  if (p10DisplayMatch) {
    const [, deviceId, suffix] = p10DisplayMatch;
    const parsedPayload = parseJsonRecord(payload);

    if (!parsedPayload || !deviceId) {
      return;
    }

    if (suffix === "telemetry") {
      await ingestP10DisplayTelemetry(deviceId, parsedPayload);
      return;
    }

    if (suffix === "state") {
      await ingestP10DisplayState(deviceId, parsedPayload);
      return;
    }

    if (suffix === "command/ack") {
      await ingestP10DisplayCommandAck(deviceId, parsedPayload);
    }

    return;
  }

  const tokenDispenserMatch = tokenDispenserTopicPattern.exec(topic);

  if (tokenDispenserMatch) {
    const [, deviceId, suffix] = tokenDispenserMatch;
    const parsedPayload = parseJsonRecord(payload);

    if (!parsedPayload || !deviceId) {
      return;
    }

    if (suffix === "telemetry") {
      await ingestTokenDispenserTelemetry(deviceId, parsedPayload);
      return;
    }

    if (suffix === "state") {
      await ingestTokenDispenserState(deviceId, parsedPayload);
      return;
    }

    if (suffix === "event") {
      await ingestTokenDispenserEvent(deviceId, parsedPayload);
    }
  }
}

function parseJsonRecord(payload: Buffer): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(payload.toString("utf8"));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
