import { FiActivity, FiBell, FiClock, FiZap } from "react-icons/fi";
import type { IconType } from "react-icons";

import type {
  SceneAction,
  SceneActionType,
  SceneCondition,
  SceneConditionOperator,
  SceneRecord,
  SceneSchedule,
  SceneThresholdComparator,
  SceneTrigger,
  SceneTriggerType
} from "@jenix/shared";

import type {
  SceneBuilderActionDraft,
  SceneBuilderConditionDraft,
  SceneBuilderDraft,
  SceneBuilderScheduleDraft,
  SceneBuilderTriggerDraft
} from "./sceneBuilder";

export type SceneKind = "run" | "automation";

export interface SceneVisual {
  icon: IconType;
  color: string;
}

const automationTriggerTypes: SceneTriggerType[] = ["schedule", "device_threshold"];

function hasAutomationTrigger(triggerTypes: SceneTriggerType[]): boolean {
  return triggerTypes.some((type) => automationTriggerTypes.includes(type));
}

export function classifySceneRecord(scene: SceneRecord): SceneKind {
  return hasAutomationTrigger(scene.triggers.map((trigger) => trigger.type))
    ? "automation"
    : "run";
}

export function classifySceneDraft(draft: SceneBuilderDraft): SceneKind {
  return hasAutomationTrigger(draft.triggers.map((trigger) => trigger.type))
    ? "automation"
    : "run";
}

export function findAutomationTrigger(
  triggers: SceneTrigger[]
): SceneTrigger | undefined {
  return triggers.find((trigger) => automationTriggerTypes.includes(trigger.type));
}

export function findAutomationTriggerDraft(
  triggers: SceneBuilderTriggerDraft[]
): SceneBuilderTriggerDraft | undefined {
  return triggers.find((trigger) => automationTriggerTypes.includes(trigger.type));
}

export function getTriggerVisual(type: SceneTriggerType): SceneVisual {
  if (type === "schedule") {
    return { icon: FiClock, color: "var(--warning)" };
  }

  if (type === "device_threshold") {
    return { icon: FiActivity, color: "var(--info)" };
  }

  return { icon: FiZap, color: "#7c6fd1" };
}

export function getActionVisual(type: SceneActionType): SceneVisual {
  if (type === "notification") {
    return { icon: FiBell, color: "var(--success)" };
  }

  return { icon: FiZap, color: "var(--ink)" };
}

export function getSceneDraftVisual(draft: SceneBuilderDraft): SceneVisual {
  const automationTrigger = findAutomationTriggerDraft(draft.triggers);

  if (automationTrigger) {
    return getTriggerVisual(automationTrigger.type);
  }

  const firstAction = draft.actions[0];
  return firstAction ? getActionVisual(firstAction.type) : getTriggerVisual("manual");
}

export function getSceneVisual(scene: SceneRecord): SceneVisual {
  const automationTrigger = findAutomationTrigger(scene.triggers);

  if (automationTrigger) {
    return getTriggerVisual(automationTrigger.type);
  }

  const firstAction = scene.actions[0];
  return firstAction ? getActionVisual(firstAction.type) : getTriggerVisual("manual");
}

const comparatorSymbols: Record<SceneThresholdComparator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤"
};

const operatorSymbols: Record<SceneConditionOperator, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤"
};

const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatScheduleTime(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) {
    return time;
  }

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

export function formatScheduleDays(daysOfWeek: number[]): string {
  const sorted = [...daysOfWeek].sort();

  if (sorted.length === 7) {
    return "Daily";
  }

  if (sorted.length === 5 && sorted.join(",") === "1,2,3,4,5") {
    return "Weekdays";
  }

  if (sorted.length === 2 && sorted.join(",") === "0,6") {
    return "Weekends";
  }

  if (sorted.length === 0) {
    return "No days selected";
  }

  return sorted.map((day) => shortDayNames[day]).join(", ");
}

export function describeSchedule(schedule: SceneSchedule | undefined): string {
  if (!schedule) {
    return "Set a time";
  }

  return `${formatScheduleDays(schedule.daysOfWeek)} at ${formatScheduleTime(schedule.time)}`;
}

export function describeTrigger(
  trigger: SceneTrigger,
  schedule: SceneSchedule | undefined
): string {
  if (trigger.type === "schedule") {
    return describeSchedule(schedule);
  }

  if (trigger.type === "device_threshold") {
    const device = trigger.deviceId || "Device";
    const metric = trigger.metricKey || "value";
    const comparator = trigger.comparator ? comparatorSymbols[trigger.comparator] : "≥";
    const threshold = typeof trigger.threshold === "number" ? trigger.threshold : "—";
    return `${device} · ${metric} ${comparator} ${threshold}`;
  }

  return "Manual trigger";
}

export function describeCondition(condition: SceneCondition): string {
  return `${condition.field} ${operatorSymbols[condition.operator]} ${String(condition.value)}`;
}

export function describeAction(action: SceneAction): string {
  if (action.type === "notification") {
    return action.message ? `Notify: ${action.message}` : "Notify household";
  }

  if (action.command && action.deviceId) {
    return `${action.deviceId} · ${action.command.replace(/_/g, " ")}`;
  }

  if (action.command) {
    return action.command.replace(/_/g, " ");
  }

  return "Device command";
}

export function ifSummaryForScene(scene: SceneRecord): string {
  const automationTrigger = findAutomationTrigger(scene.triggers);
  const parts = [
    ...(automationTrigger ? [describeTrigger(automationTrigger, scene.schedule)] : []),
    ...scene.conditions.map(describeCondition)
  ];

  return parts.length > 0 ? parts.join(" and ") : "Always";
}

export function thenSummaryForScene(scene: SceneRecord): string {
  if (scene.actions.length === 0) {
    return "No actions";
  }

  return scene.actions.map(describeAction).join(", ");
}

const draftComparatorSymbols: Record<SceneThresholdComparator, string> = comparatorSymbols;
const draftOperatorSymbols: Record<SceneConditionOperator, string> = operatorSymbols;

export function describeTriggerDraft(
  trigger: SceneBuilderTriggerDraft,
  schedule: SceneBuilderScheduleDraft
): string {
  if (trigger.type === "schedule") {
    if (!schedule.enabled) {
      return "Set a time";
    }

    return `${formatScheduleDays(schedule.daysOfWeek)} at ${formatScheduleTime(schedule.time)}`;
  }

  if (trigger.type === "device_threshold") {
    const device = trigger.deviceId.trim() || "Choose a device";
    const metric = trigger.metricKey.trim() || "metric";
    const comparator = draftComparatorSymbols[trigger.comparator];
    const threshold = trigger.threshold.trim() || "—";
    return `${device} · ${metric} ${comparator} ${threshold}`;
  }

  return "Manual trigger";
}

export function describeConditionDraft(condition: SceneBuilderConditionDraft): string {
  const field = condition.field.trim() || "field";
  const value = condition.value.trim() || "value";
  return `${field} ${draftOperatorSymbols[condition.operator]} ${value}`;
}

export function describeActionDraft(action: SceneBuilderActionDraft): string {
  if (action.type === "notification") {
    return action.message.trim() ? `Notify: ${action.message.trim()}` : "Notify household";
  }

  const device = action.deviceId.trim() || "Choose a device";
  return `${device} · ${action.command.replace(/_/g, " ")}`;
}
