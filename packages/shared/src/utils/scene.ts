import type {
  SceneActionCommand,
  SceneConditionOperator,
  ScenePrimitiveValue
} from "../types/scene";

const restrictedSceneCommands = new Set<SceneActionCommand>([
  "factory_reset",
  "ota_force",
  "matter_commission",
  "matter_bridge_sync"
]);

export function isRestrictedSceneCommand(command: SceneActionCommand): boolean {
  return restrictedSceneCommands.has(command);
}

/**
 * Canonical list of every SceneActionCommand the platform knows about. This
 * is the single source of truth other layers derive from instead of hand
 * -maintaining their own copy (which is how the frontend command picker and
 * the backend request validator each drifted out of sync with the type
 * union and with each other).
 */
export const allSceneActionCommands: SceneActionCommand[] = [
  "refresh",
  "sync",
  "set_relay",
  "notify",
  "zero_calibrate",
  "apply_settings",
  "motor_on",
  "motor_off",
  "alarm_test",
  "factory_reset",
  "ota_force",
  "matter_commission",
  "matter_bridge_sync",
  "attend_call",
  "start_learning",
  "restart",
  "trigger_alarm",
  "stop_alarm",
  "start_stream",
  "stop_stream"
];

const sceneActionCommandLabels: Partial<Record<SceneActionCommand, string>> = {
  refresh: "Refresh reading",
  sync: "Sync",
  set_relay: "Set relay",
  notify: "Notify",
  zero_calibrate: "Zero calibrate sensor",
  apply_settings: "Apply settings",
  motor_on: "Turn pump on",
  motor_off: "Turn pump off",
  alarm_test: "Test alarm",
  factory_reset: "Factory reset",
  ota_force: "Force OTA update",
  matter_commission: "Matter commission",
  matter_bridge_sync: "Matter bridge sync",
  attend_call: "Attend call",
  start_learning: "Start RF learning",
  restart: "Restart device",
  trigger_alarm: "Trigger alarm",
  stop_alarm: "Stop alarm",
  start_stream: "Start stream",
  stop_stream: "Stop stream"
};

export function describeSceneActionCommand(command: SceneActionCommand): string {
  return sceneActionCommandLabels[command] ?? command.replace(/_/g, " ");
}

function compareAsNumber(
  left: ScenePrimitiveValue,
  right: ScenePrimitiveValue,
  operator: Extract<SceneConditionOperator, "gt" | "gte" | "lt" | "lte">
): boolean {
  if (typeof left !== "number" || typeof right !== "number") {
    return false;
  }

  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
  }
}

export function evaluateSceneCondition(
  left: ScenePrimitiveValue | undefined,
  operator: SceneConditionOperator,
  right: ScenePrimitiveValue
): boolean {
  if (left === undefined) {
    return false;
  }

  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compareAsNumber(left, right, operator);
  }
}
