import type {
  SceneActionCommand,
  SceneConditionOperator,
  ScenePrimitiveValue
} from "../types/scene";

const restrictedSceneCommands = new Set<SceneActionCommand>([
  "factory_reset",
  "ota_force"
]);

export function isRestrictedSceneCommand(command: SceneActionCommand): boolean {
  return restrictedSceneCommands.has(command);
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
