import type {
  HomeAccessRole,
  SceneAction,
  SceneCondition,
  SceneRecord,
  SceneRunResult,
  SceneSchedule,
  SceneStatus,
  SceneTelemetrySnapshot,
  SceneTrigger
} from "@jenix/shared";

export interface SceneRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface SceneTriggerInput extends Omit<SceneTrigger, "triggerId"> {
  triggerId?: string;
}

export interface SceneConditionInput extends Omit<SceneCondition, "conditionId"> {
  conditionId?: string;
}

export interface SceneActionInput extends Omit<SceneAction, "actionId"> {
  actionId?: string;
}

export interface CreateScenePayload {
  name: string;
  status?: SceneStatus;
  triggers: SceneTriggerInput[];
  conditions: SceneConditionInput[];
  actions: SceneActionInput[];
  schedule?: SceneSchedule;
}

export interface ScenePatchPayload {
  name?: string;
  status?: SceneStatus;
  triggers?: SceneTriggerInput[];
  conditions?: SceneConditionInput[];
  actions?: SceneActionInput[];
  schedule?: SceneSchedule;
}

export interface ManualRunPayload {
  telemetry?: SceneTelemetrySnapshot;
}

export interface TelemetryRuntimePayload {
  deviceId: string;
  telemetry: SceneTelemetrySnapshot;
  occurredAt?: string;
}

export interface ScheduleRuntimePayload {
  occurredAt?: string;
}

export class SceneModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "SceneModuleError";
  }
}

export interface SceneRunResponse extends SceneRunResult {
  scene: SceneRecord;
}

export type SceneRuntimeSource = "manual" | "device_threshold" | "schedule";

export interface SceneRunHistoryEntry extends SceneRunResult {
  runId: string;
  sceneId: string;
  source: SceneRuntimeSource;
  triggeredAt: string;
  sceneStatus: SceneStatus;
  telemetry?: SceneTelemetrySnapshot;
  dedupeKey?: string;
}

export interface SceneRuntimeBatchResponse {
  evaluatedSceneCount: number;
  matchedRunCount: number;
  runs: SceneRunResponse[];
}

export interface SceneAuditEntry {
  auditId: string;
  sceneId: string;
  actorId: string;
  action: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
