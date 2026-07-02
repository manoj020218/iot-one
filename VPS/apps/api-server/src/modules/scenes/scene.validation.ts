import type {
  SceneActionCommand,
  SceneConditionOperator,
  ScenePrimitiveValue,
  SceneSchedule,
  SceneStatus,
  SceneThresholdComparator,
  SceneTriggerType
} from "@jenix/shared";

import type {
  CreateScenePayload,
  ManualRunPayload,
  ScheduleRuntimePayload,
  SceneActionInput,
  SceneConditionInput,
  ScenePatchPayload,
  SceneTriggerInput,
  TelemetryRuntimePayload
} from "./scene.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value
  } as Record<K, V>;
}

function parseSceneStatus(value: unknown): SceneStatus | undefined {
  return value === "draft" || value === "active" || value === "paused"
    ? value
    : undefined;
}

function parseTriggerType(value: unknown): SceneTriggerType | undefined {
  return value === "manual" || value === "device_threshold" || value === "schedule"
    ? value
    : undefined;
}

function parseThresholdComparator(
  value: unknown
): SceneThresholdComparator | undefined {
  return value === "gt" || value === "gte" || value === "lt" || value === "lte"
    ? value
    : undefined;
}

function parseConditionOperator(
  value: unknown
): SceneConditionOperator | undefined {
  return value === "eq" ||
    value === "neq" ||
    value === "gt" ||
    value === "gte" ||
    value === "lt" ||
    value === "lte"
    ? value
    : undefined;
}

function parsePrimitiveValue(value: unknown): ScenePrimitiveValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const timestamp = value.trim();
  return Number.isNaN(Date.parse(timestamp)) ? undefined : timestamp;
}

function parseTelemetrySnapshot(
  value: unknown
): Record<string, ScenePrimitiveValue> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.entries(value).reduce<Record<string, ScenePrimitiveValue>>(
    (snapshot, [key, entryValue]) => {
      const primitiveValue = parsePrimitiveValue(entryValue);

      if (primitiveValue !== undefined) {
        snapshot[key] = primitiveValue;
      }

      return snapshot;
    },
    {}
  );
}

function parseSceneActionCommand(
  value: unknown
): SceneActionCommand | undefined {
  return value === "refresh" ||
    value === "sync" ||
    value === "set_relay" ||
    value === "notify" ||
    value === "factory_reset" ||
    value === "ota_force"
    ? value
    : undefined;
}

function parseTrigger(value: unknown): SceneTriggerInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = parseTriggerType(value.type);
  if (!type) {
    return null;
  }

  const threshold =
    typeof value.threshold === "number" ? value.threshold : undefined;

  return {
    type,
    ...optionalProp("triggerId", readTrimmedString(value, "triggerId")),
    ...optionalProp("deviceId", readTrimmedString(value, "deviceId")),
    ...optionalProp("metricKey", readTrimmedString(value, "metricKey")),
    ...optionalProp("comparator", parseThresholdComparator(value.comparator)),
    ...optionalProp("threshold", threshold)
  };
}

function parseCondition(value: unknown): SceneConditionInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const field = readTrimmedString(value, "field");
  const operator = parseConditionOperator(value.operator);
  const primitiveValue = parsePrimitiveValue(value.value);

  if (!field || !operator || primitiveValue === undefined) {
    return null;
  }

  return {
    field,
    operator,
    value: primitiveValue,
    ...optionalProp("conditionId", readTrimmedString(value, "conditionId"))
  };
}

function parseAction(value: unknown): SceneActionInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const type =
    value.type === "device_command" || value.type === "notification"
      ? value.type
      : undefined;

  if (!type) {
    return null;
  }

  const command = parseSceneActionCommand(value.command);
  const message = readTrimmedString(value, "message");
  const payload = isRecord(value.payload) ? value.payload : undefined;

  if (type === "device_command" && !command) {
    return null;
  }

  if (type === "notification" && !message) {
    return null;
  }

  return {
    type,
    ...optionalProp("actionId", readTrimmedString(value, "actionId")),
    ...optionalProp("deviceId", readTrimmedString(value, "deviceId")),
    ...optionalProp("command", command),
    ...optionalProp("message", message),
    ...optionalProp("payload", payload)
  };
}

function parseSchedule(value: unknown): SceneSchedule | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const timezone = readTrimmedString(value, "timezone");
  const time = readTrimmedString(value, "time");
  const daysOfWeek = Array.isArray(value.daysOfWeek)
    ? value.daysOfWeek.filter(
        (day): day is number =>
          typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6
      )
    : [];

  if (!timezone || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return undefined;
  }

  return {
    timezone,
    daysOfWeek,
    time
  };
}

function parseTriggerArray(value: unknown): SceneTriggerInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.map(parseTrigger);
  return parsed.every((item) => item !== null)
    ? (parsed as SceneTriggerInput[])
    : null;
}

function parseConditionArray(value: unknown): SceneConditionInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.map(parseCondition);
  return parsed.every((item) => item !== null)
    ? (parsed as SceneConditionInput[])
    : null;
}

function parseActionArray(value: unknown): SceneActionInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.map(parseAction);
  return parsed.every((item) => item !== null)
    ? (parsed as SceneActionInput[])
    : null;
}

export function parseCreateScenePayload(body: unknown): CreateScenePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const name = readTrimmedString(body, "name");
  const triggers = parseTriggerArray(body.triggers);
  const conditions = parseConditionArray(body.conditions);
  const actions = parseActionArray(body.actions);

  if (!name || !triggers || !conditions || !actions || actions.length === 0) {
    return null;
  }

  return {
    name,
    triggers,
    conditions,
    actions,
    ...optionalProp("status", parseSceneStatus(body.status)),
    ...optionalProp("schedule", parseSchedule(body.schedule))
  };
}

export function parseScenePatchPayload(body: unknown): ScenePatchPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const patch: ScenePatchPayload = {};

  const name = readTrimmedString(body, "name");
  if (name) {
    patch.name = name;
  }

  const status = parseSceneStatus(body.status);
  if (status) {
    patch.status = status;
  }

  if (body.triggers !== undefined) {
    const triggers = parseTriggerArray(body.triggers);
    if (!triggers) {
      return null;
    }
    patch.triggers = triggers;
  }

  if (body.conditions !== undefined) {
    const conditions = parseConditionArray(body.conditions);
    if (!conditions) {
      return null;
    }
    patch.conditions = conditions;
  }

  if (body.actions !== undefined) {
    const actions = parseActionArray(body.actions);
    if (!actions || actions.length === 0) {
      return null;
    }
    patch.actions = actions;
  }

  if (body.schedule !== undefined) {
    const schedule = parseSchedule(body.schedule);
    if (!schedule) {
      return null;
    }
    patch.schedule = schedule;
  }

  return Object.keys(patch).length ? patch : null;
}

export function parseManualRunPayload(body: unknown): ManualRunPayload | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (!isRecord(body)) {
    return null;
  }

  const telemetry = parseTelemetrySnapshot(body.telemetry);

  return telemetry ? { telemetry } : {};
}

export function parseTelemetryRuntimePayload(
  body: unknown
): TelemetryRuntimePayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const deviceId = readTrimmedString(body, "deviceId");
  const telemetry = parseTelemetrySnapshot(body.telemetry);

  if (!deviceId || !telemetry) {
    return null;
  }

  return {
    deviceId,
    telemetry,
    ...optionalProp("occurredAt", parseIsoTimestamp(body.occurredAt))
  };
}

export function parseScheduleRuntimePayload(
  body: unknown
): ScheduleRuntimePayload | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (!isRecord(body)) {
    return null;
  }

  const occurredAt = parseIsoTimestamp(body.occurredAt);
  return occurredAt ? { occurredAt } : {};
}
