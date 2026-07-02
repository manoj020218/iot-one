import type {
  SceneAction,
  SceneActionCommand,
  SceneActionType,
  SceneCondition,
  SceneConditionOperator,
  ScenePrimitiveValue,
  SceneRecord,
  SceneSchedule,
  SceneStatus,
  SceneThresholdComparator,
  SceneTrigger,
  SceneTriggerType
} from "@jenix/shared";

import type {
  SceneActionInput,
  SceneConditionInput,
  SceneCreateInput,
  SceneTriggerInput,
  SceneUpdateInput
} from "./sceneApi";

export interface SceneBuilderTriggerDraft {
  triggerId: string;
  type: SceneTriggerType;
  deviceId: string;
  metricKey: string;
  comparator: SceneThresholdComparator;
  threshold: string;
}

export interface SceneBuilderConditionDraft {
  conditionId: string;
  field: string;
  operator: SceneConditionOperator;
  value: string;
}

export interface SceneBuilderActionDraft {
  actionId: string;
  type: SceneActionType;
  deviceId: string;
  command: SceneActionCommand;
  message: string;
  payloadText: string;
}

export interface SceneBuilderScheduleDraft {
  enabled: boolean;
  timezone: string;
  daysOfWeek: number[];
  time: string;
}

export interface SceneBuilderDraft {
  name: string;
  status: SceneStatus;
  triggers: SceneBuilderTriggerDraft[];
  conditions: SceneBuilderConditionDraft[];
  actions: SceneBuilderActionDraft[];
  schedule: SceneBuilderScheduleDraft;
}

export const sceneTriggerTypeOptions: SceneTriggerType[] = [
  "manual",
  "device_threshold",
  "schedule"
];

export const sceneComparatorOptions: SceneThresholdComparator[] = [
  "gt",
  "gte",
  "lt",
  "lte"
];

export const sceneConditionOperatorOptions: SceneConditionOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte"
];

export const sceneActionTypeOptions: SceneActionType[] = [
  "device_command",
  "notification"
];

export const sceneActionCommandOptions: SceneActionCommand[] = [
  "refresh",
  "sync",
  "set_relay",
  "notify",
  "factory_reset",
  "ota_force",
  "matter_commission",
  "matter_bridge_sync"
];

export const sceneStatusOptions: SceneStatus[] = ["draft", "active", "paused"];

const defaultTimezone = "Asia/Kolkata";

function createClientId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
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

function toStringValue(value: ScenePrimitiveValue): string {
  return String(value);
}

function formatPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload || Object.keys(payload).length === 0) {
    return "";
  }

  return JSON.stringify(payload, null, 2);
}

export function createEmptyTriggerDraft(): SceneBuilderTriggerDraft {
  return {
    triggerId: createClientId("trigger"),
    type: "manual",
    deviceId: "",
    metricKey: "",
    comparator: "gte",
    threshold: ""
  };
}

export function createEmptyConditionDraft(): SceneBuilderConditionDraft {
  return {
    conditionId: createClientId("condition"),
    field: "",
    operator: "gte",
    value: ""
  };
}

export function createEmptyActionDraft(): SceneBuilderActionDraft {
  return {
    actionId: createClientId("action"),
    type: "notification",
    deviceId: "",
    command: "sync",
    message: "",
    payloadText: ""
  };
}

export function createInitialSceneDraft(
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimezone
): SceneBuilderDraft {
  return {
    name: "",
    status: "draft",
    triggers: [createEmptyTriggerDraft()],
    conditions: [],
    actions: [createEmptyActionDraft()],
    schedule: {
      enabled: false,
      timezone,
      daysOfWeek: [1, 2, 3, 4, 5],
      time: "08:00"
    }
  };
}

function mapTriggerToDraft(trigger: SceneTrigger): SceneBuilderTriggerDraft {
  return {
    triggerId: trigger.triggerId,
    type: trigger.type,
    deviceId: trigger.deviceId ?? "",
    metricKey: trigger.metricKey ?? "",
    comparator: trigger.comparator ?? "gte",
    threshold:
      typeof trigger.threshold === "number" ? String(trigger.threshold) : ""
  };
}

function mapConditionToDraft(
  condition: SceneCondition
): SceneBuilderConditionDraft {
  return {
    conditionId: condition.conditionId,
    field: condition.field,
    operator: condition.operator,
    value: toStringValue(condition.value)
  };
}

function mapActionToDraft(action: SceneAction): SceneBuilderActionDraft {
  return {
    actionId: action.actionId,
    type: action.type,
    deviceId: action.deviceId ?? "",
    command: action.command ?? "sync",
    message: action.message ?? "",
    payloadText: formatPayload(action.payload)
  };
}

export function sceneRecordToDraft(scene: SceneRecord): SceneBuilderDraft {
  return {
    name: scene.name,
    status: scene.status,
    triggers: scene.triggers.length
      ? scene.triggers.map(mapTriggerToDraft)
      : [createEmptyTriggerDraft()],
    conditions: scene.conditions.map(mapConditionToDraft),
    actions: scene.actions.length
      ? scene.actions.map(mapActionToDraft)
      : [createEmptyActionDraft()],
    schedule: {
      enabled: Boolean(scene.schedule),
      timezone: scene.schedule?.timezone ?? defaultTimezone,
      daysOfWeek: scene.schedule?.daysOfWeek ?? [1, 2, 3, 4, 5],
      time: scene.schedule?.time ?? "08:00"
    }
  };
}

function parsePrimitiveValue(rawValue: string): ScenePrimitiveValue {
  const trimmed = rawValue.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

function parsePayloadText(payloadText: string): Record<string, unknown> | undefined {
  const trimmed = payloadText.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Action payload must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function toTriggerInput(draft: SceneBuilderTriggerDraft): SceneTriggerInput {
  const threshold =
    draft.threshold.trim() === "" ? undefined : Number(draft.threshold);

  return {
    triggerId: draft.triggerId,
    type: draft.type,
    ...optionalProp("deviceId", draft.deviceId.trim() || undefined),
    ...optionalProp("metricKey", draft.metricKey.trim() || undefined),
    ...optionalProp("comparator", draft.comparator),
    ...optionalProp(
      "threshold",
      typeof threshold === "number" && Number.isFinite(threshold)
        ? threshold
        : undefined
    )
  };
}

function toConditionInput(
  draft: SceneBuilderConditionDraft
): SceneConditionInput {
  return {
    conditionId: draft.conditionId,
    field: draft.field.trim(),
    operator: draft.operator,
    value: parsePrimitiveValue(draft.value)
  };
}

function toActionInput(draft: SceneBuilderActionDraft): SceneActionInput {
  return {
    actionId: draft.actionId,
    type: draft.type,
    ...optionalProp("deviceId", draft.deviceId.trim() || undefined),
    ...optionalProp("command", draft.type === "device_command" ? draft.command : undefined),
    ...optionalProp("message", draft.type === "notification" ? draft.message.trim() : undefined),
    ...optionalProp(
      "payload",
      draft.type === "device_command"
        ? parsePayloadText(draft.payloadText)
        : undefined
    )
  };
}

function toScheduleInput(
  draft: SceneBuilderScheduleDraft
): SceneSchedule | undefined {
  if (!draft.enabled) {
    return undefined;
  }

  return {
    timezone: draft.timezone.trim() || defaultTimezone,
    daysOfWeek: draft.daysOfWeek,
    time: draft.time
  };
}

function validateTrigger(
  trigger: SceneBuilderTriggerDraft,
  index: number,
  errors: string[],
  scheduleEnabled: boolean
) {
  const label = `Trigger ${index + 1}`;

  if (trigger.type === "device_threshold") {
    if (!trigger.deviceId.trim()) {
      errors.push(`${label} requires a device.`);
    }

    if (!trigger.metricKey.trim()) {
      errors.push(`${label} requires a metric key.`);
    }

    if (trigger.threshold.trim() === "" || Number.isNaN(Number(trigger.threshold))) {
      errors.push(`${label} requires a numeric threshold.`);
    }
  }

  if (trigger.type === "schedule" && !scheduleEnabled) {
    errors.push(`${label} needs schedule details enabled below.`);
  }
}

function validateCondition(
  condition: SceneBuilderConditionDraft,
  index: number,
  errors: string[]
) {
  const label = `Condition ${index + 1}`;

  if (!condition.field.trim()) {
    errors.push(`${label} requires a field key.`);
  }

  if (!condition.value.trim()) {
    errors.push(`${label} requires a comparison value.`);
  }
}

function validateAction(
  action: SceneBuilderActionDraft,
  index: number,
  errors: string[]
) {
  const label = `Action ${index + 1}`;

  if (action.type === "device_command") {
    if (!action.deviceId.trim()) {
      errors.push(`${label} requires a target device.`);
    }

    try {
      parsePayloadText(action.payloadText);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${label} payload is invalid.`);
    }
  }

  if (action.type === "notification" && !action.message.trim()) {
    errors.push(`${label} requires a notification message.`);
  }
}

export function validateSceneDraft(draft: SceneBuilderDraft): string[] {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push("Scene name is required.");
  }

  if (draft.triggers.length === 0) {
    errors.push("At least one trigger is required.");
  }

  if (draft.actions.length === 0) {
    errors.push("At least one action is required.");
  }

  draft.triggers.forEach((trigger, index) =>
    validateTrigger(trigger, index, errors, draft.schedule.enabled)
  );
  draft.conditions.forEach((condition, index) =>
    validateCondition(condition, index, errors)
  );
  draft.actions.forEach((action, index) => validateAction(action, index, errors));

  if (draft.schedule.enabled) {
    if (!/^\d{2}:\d{2}$/.test(draft.schedule.time)) {
      errors.push("Schedule time must use HH:MM format.");
    }

    if (draft.schedule.daysOfWeek.length === 0) {
      errors.push("Schedule requires at least one active day.");
    }

    if (!draft.triggers.some((trigger) => trigger.type === "schedule")) {
      errors.push("Enable at least one schedule trigger to use schedule details.");
    }
  }

  return errors;
}

export function draftToCreateInput(draft: SceneBuilderDraft): SceneCreateInput {
  return {
    name: draft.name.trim(),
    status: draft.status,
    triggers: draft.triggers.map(toTriggerInput),
    conditions: draft.conditions.map(toConditionInput),
    actions: draft.actions.map(toActionInput),
    ...optionalProp("schedule", toScheduleInput(draft.schedule))
  };
}

export function draftToUpdateInput(draft: SceneBuilderDraft): SceneUpdateInput {
  return draftToCreateInput(draft);
}
