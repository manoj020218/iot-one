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
  // Token Dispenser's own commands are UPPER_SNAKE_CASE (not lower_snake_case
  // like the rest of this union) because they're published verbatim onto the
  // device's MQTT `cmd` topic and matched by literal strcmp() in the
  // firmware's handleCommand() — changing the case here would break wire
  // compatibility with already-flashed units.
  | "refresh"
  | "sync"
  | "set_relay"
  | "notify"
  | "zero_calibrate"
  | "apply_settings"
  | "motor_on"
  | "motor_off"
  | "alarm_test"
  | "factory_reset"
  | "ota_force"
  | "matter_commission"
  | "matter_bridge_sync"
  | "attend_call"
  | "start_learning"
  | "cancel_learning"
  | "restart"
  | "trigger_alarm"
  | "stop_alarm"
  | "start_stream"
  | "stop_stream"
  | "unlock"
  | "PRINT_NEXT_TOKEN"
  | "TEST_PRINT"
  | "RESET_ROLL_COUNTER"
  | "SET_TOKEN_COUNTER"
  | "SET_TOKEN_PREFIX"
  | "SET_LED_COUNT"
  | "SET_TEMPLATE"
  | "REBOOT"
  | "OTA_UPDATE"
  | "FACTORY_RESET";

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

export type SceneActionDispatchStatus =
  | "queued"
  | "processing"
  | "dispatched"
  | "completed"
  | "failed";

export interface SceneActionDispatchRecord {
  jobId: string;
  runId: string;
  sceneId: string;
  homeId: string;
  source: "manual" | "device_threshold" | "schedule";
  action: SceneAction;
  requestedAt: string;
  attemptCount: number;
  status: SceneActionDispatchStatus;
  processingWorkerId?: string;
  processingStartedAt?: string;
  visibleAfter?: string;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  replayedFromJobId?: string;
}
