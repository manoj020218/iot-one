import type {
  SmartRfConfigPatch,
  SmartRfProfileInput,
  SmartRfProfileMode,
  SmartRfTriggerAction
} from "./smart-rf-transmitter.types";

export interface SmartRfValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface SmartRfValidationFailure {
  ok: false;
  errors: string[];
}

export type SmartRfValidationResult<T> = SmartRfValidationSuccess<T> | SmartRfValidationFailure;

const profileModes: SmartRfProfileMode[] = ["INCHING", "LATCHING", "TOGGLE"];
const triggerActions: SmartRfTriggerAction[] = ["TRIGGER", "TURN_ON", "TURN_OFF", "TOGGLE"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProfilePayload(
  routeProfileId: number,
  body: unknown
): SmartRfValidationResult<SmartRfProfileInput> {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Profile payload must be an object"] };
  }

  const errors: string[] = [];
  const mode = body.mode;

  if (mode !== undefined && !profileModes.includes(mode as SmartRfProfileMode)) {
    errors.push(`mode must be one of: ${profileModes.join(", ")}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      profileId: routeProfileId,
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.rfCodeHex === "string" ? { rfCodeHex: body.rfCodeHex } : {}),
      ...(typeof body.remoteIdHex === "string" ? { remoteIdHex: body.remoteIdHex } : {}),
      ...(typeof body.buttonCode === "number" ? { buttonCode: body.buttonCode } : {}),
      ...(typeof body.bitLength === "number" ? { bitLength: body.bitLength } : {}),
      ...(typeof body.pulseWidthUs === "number" ? { pulseWidthUs: body.pulseWidthUs } : {}),
      ...(typeof body.repeatCount === "number" ? { repeatCount: body.repeatCount } : {}),
      ...(typeof body.pulseDurationMs === "number"
        ? { pulseDurationMs: body.pulseDurationMs }
        : {}),
      ...(typeof body.cooldownMs === "number" ? { cooldownMs: body.cooldownMs } : {}),
      ...(mode !== undefined ? { mode: mode as SmartRfProfileMode } : {}),
      ...(typeof body.assumedStateAfterTrigger === "string"
        ? { assumedStateAfterTrigger: body.assumedStateAfterTrigger }
        : {}),
      ...(typeof body.persistState === "boolean" ? { persistState: body.persistState } : {})
    }
  };
}

export function parseTriggerPayload(
  body: unknown
): SmartRfValidationResult<{ profileId: number; action: SmartRfTriggerAction }> {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Trigger payload must be an object"] };
  }

  const profileId = body.profileId;

  if (typeof profileId !== "number" || !Number.isInteger(profileId) || profileId <= 0) {
    return { ok: false, errors: ["profileId must be a positive integer"] };
  }

  const action = body.action ?? "TRIGGER";

  if (!triggerActions.includes(action as SmartRfTriggerAction)) {
    return {
      ok: false,
      errors: [`action must be one of: ${triggerActions.join(", ")}`]
    };
  }

  return { ok: true, data: { profileId, action: action as SmartRfTriggerAction } };
}

export function parseSequencePayload(
  body: unknown
): SmartRfValidationResult<{ profileIds: number[]; delayMs: number }> {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Sequence payload must be an object"] };
  }

  const profileIds = Array.isArray(body.profileIds)
    ? body.profileIds.filter(
        (value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0
      )
    : [];

  if (!profileIds.length) {
    return { ok: false, errors: ["profileIds must contain at least one positive integer"] };
  }

  const delayMs = typeof body.delayMs === "number" ? body.delayMs : 500;

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    return { ok: false, errors: ["delayMs must be a non-negative number"] };
  }

  return { ok: true, data: { profileIds, delayMs } };
}

export function parseConfigPatchPayload(body: unknown): SmartRfValidationResult<SmartRfConfigPatch> {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Config payload must be an object"] };
  }

  const patch: SmartRfConfigPatch = {};

  if (typeof body.deviceName === "string") patch.deviceName = body.deviceName.trim();
  if (typeof body.productProfile === "string") patch.productProfile = body.productProfile.trim();
  if (typeof body.wifiSsid === "string") patch.wifiSsid = body.wifiSsid;
  if (typeof body.wifiPassword === "string") patch.wifiPassword = body.wifiPassword;
  if (typeof body.clearWifi === "boolean") patch.clearWifi = body.clearWifi;
  if (typeof body.mqttHost === "string") patch.mqttHost = body.mqttHost.trim();
  if (typeof body.mqttPort === "number") patch.mqttPort = body.mqttPort;
  if (typeof body.mqttUsername === "string") patch.mqttUsername = body.mqttUsername;
  if (typeof body.mqttPassword === "string") patch.mqttPassword = body.mqttPassword;
  if (typeof body.clearMqttPassword === "boolean") patch.clearMqttPassword = body.clearMqttPassword;
  if (typeof body.mqttTopicRoot === "string") patch.mqttTopicRoot = body.mqttTopicRoot.trim();
  if (typeof body.cloudEnabled === "boolean") patch.cloudEnabled = body.cloudEnabled;
  if (typeof body.espnowEnabled === "boolean") patch.espnowEnabled = body.espnowEnabled;
  if (typeof body.localApiAuthEnabled === "boolean") {
    patch.localApiAuthEnabled = body.localApiAuthEnabled;
  }
  if (typeof body.localApiPin === "string") patch.localApiPin = body.localApiPin;
  if (typeof body.rfDataPin === "number") patch.rfDataPin = body.rfDataPin;

  return { ok: true, data: patch };
}

export function parseOtaUrlPayload(body: unknown): SmartRfValidationResult<{ url: string }> {
  if (!isRecord(body) || typeof body.url !== "string" || !body.url.trim()) {
    return { ok: false, errors: ["url is required"] };
  }

  const url = body.url.trim();

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, errors: ["url must start with http:// or https://"] };
  }

  return { ok: true, data: { url } };
}
