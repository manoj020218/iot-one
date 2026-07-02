export type SceneStatus = "draft" | "active" | "paused";

export type SceneTriggerType = "manual" | "device_threshold" | "schedule";

export type SceneThresholdComparator = "gt" | "gte" | "lt" | "lte";

export interface SceneTrigger {
  triggerId: string;
  type: SceneTriggerType;
  deviceId?: string;
  metricKey?: string;
  comparator?: SceneThresholdComparator;
  threshold?: number;
}

export type SceneConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type ScenePrimitiveValue = string | number | boolean;

export interface SceneCondition {
  conditionId: string;
  field: string;
  operator: SceneConditionOperator;
  value: ScenePrimitiveValue;
}

export type SceneActionType = "device_command" | "notification";

export type SceneActionCommand =
  | "refresh"
  | "sync"
  | "set_relay"
  | "notify"
  | "factory_reset"
  | "ota_force"
  | "matter_commission"
  | "matter_bridge_sync";

export interface SceneAction {
  actionId: string;
  type: SceneActionType;
  deviceId?: string;
  command?: SceneActionCommand;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface SceneSchedule {
  timezone: string;
  daysOfWeek: number[];
  time: string;
}

export type SceneRunStatus = "idle" | "success" | "blocked" | "skipped";

export interface SceneRecord {
  sceneId: string;
  homeId: string;
  ownerUserId: string;
  name: string;
  status: SceneStatus;
  triggers: SceneTrigger[];
  conditions: SceneCondition[];
  actions: SceneAction[];
  schedule?: SceneSchedule;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: SceneRunStatus;
}

export type SceneTelemetrySnapshot = Record<string, ScenePrimitiveValue>;

export interface SceneRunResult {
  sceneId: string;
  matchedConditions: boolean;
  executedActions: string[];
  blockedReason?: string;
}
