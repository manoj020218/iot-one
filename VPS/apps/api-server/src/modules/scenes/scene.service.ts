import {
  createAuditStamp,
  evaluateSceneCondition,
  isRestrictedSceneCommand,
  type HomeAccessRole,
  type SceneAction,
  type SceneCondition,
  type SceneRecord,
  type SceneSchedule,
  type SceneTelemetrySnapshot,
  type SceneTrigger
} from "@jenix/shared";

import {
  sceneAuditRepository,
  sceneRepository,
  sceneRunHistoryRepository
} from "./scene.model";
import type {
  CreateScenePayload,
  ManualRunPayload,
  ScheduleRuntimePayload,
  SceneActionInput,
  SceneAuditEntry,
  SceneRunHistoryEntry,
  SceneRuntimeBatchResponse,
  SceneRuntimeSource,
  SceneConditionInput,
  ScenePatchPayload,
  SceneRequestContext,
  SceneRunResponse,
  SceneTriggerInput,
  TelemetryRuntimePayload
} from "./scene.types";
import { SceneModuleError } from "./scene.types";

const runtimeSystemActorId = "scene-runtime";

const weekdayIndexByName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function createSceneId(): string {
  return `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNestedId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRunId(): string {
  return createNestedId("run");
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

function requireActorId(context: SceneRequestContext): string {
  if (!context.userId) {
    throw new SceneModuleError(400, "Scene actions require x-user-id");
  }

  return context.userId;
}

function requireHomeId(context: SceneRequestContext): string {
  if (!context.homeId) {
    throw new SceneModuleError(400, "Scene actions require x-home-id");
  }

  return context.homeId;
}

function resolveActorId(context: SceneRequestContext): string {
  return context.userId ?? runtimeSystemActorId;
}

function requireScene(sceneId: string): SceneRecord {
  const scene = sceneRepository.get(sceneId);

  if (!scene) {
    throw new SceneModuleError(404, `Scene not found: ${sceneId}`);
  }

  return scene;
}

function assertAccess(scene: SceneRecord, context: SceneRequestContext): SceneRecord {
  if (context.homeId && scene.homeId !== context.homeId) {
    throw new SceneModuleError(403, "Scene access denied for this HOME");
  }

  if (context.userId && scene.ownerUserId !== context.userId) {
    throw new SceneModuleError(403, "Scene access denied for this user");
  }

  return scene;
}

function assertRestrictedActionPermission(
  actions: SceneAction[],
  homeRole: HomeAccessRole | undefined
) {
  const restrictedAction = actions.find(
    (action) =>
      action.type === "device_command" &&
      action.command &&
      isRestrictedSceneCommand(action.command)
  );

  if (
    restrictedAction &&
    homeRole !== undefined &&
    homeRole !== "owner" &&
    homeRole !== "admin"
  ) {
    throw new SceneModuleError(
      403,
      `Restricted scene command requires owner/admin access: ${restrictedAction.command}`
    );
  }
}

function toTriggerRecord(input: SceneTriggerInput): SceneTrigger {
  return {
    triggerId: input.triggerId ?? createNestedId("trigger"),
    type: input.type,
    ...optionalProp("deviceId", input.deviceId),
    ...optionalProp("metricKey", input.metricKey),
    ...optionalProp("comparator", input.comparator),
    ...optionalProp("threshold", input.threshold)
  };
}

function toConditionRecord(input: SceneConditionInput): SceneCondition {
  return {
    conditionId: input.conditionId ?? createNestedId("condition"),
    field: input.field,
    operator: input.operator,
    value: input.value
  };
}

function toActionRecord(input: SceneActionInput): SceneAction {
  return {
    actionId: input.actionId ?? createNestedId("action"),
    type: input.type,
    ...optionalProp("deviceId", input.deviceId),
    ...optionalProp("command", input.command),
    ...optionalProp("message", input.message),
    ...optionalProp("payload", input.payload)
  };
}

function writeAudit(
  sceneId: string,
  actorId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  const stamp = createAuditStamp({
    actorId,
    action
  });
  const entry: SceneAuditEntry = {
    auditId: createNestedId("audit"),
    sceneId,
    actorId: stamp.actorId,
    action: stamp.action,
    occurredAt: stamp.occurredAt,
    ...optionalProp("metadata", metadata)
  };

  sceneAuditRepository.append(entry);
}

function appendRunHistory(entry: SceneRunHistoryEntry) {
  sceneRunHistoryRepository.append(entry);
}

function evaluateConditions(
  scene: SceneRecord,
  telemetry: ManualRunPayload["telemetry"]
): boolean {
  if (scene.conditions.length === 0) {
    return true;
  }

  return scene.conditions.every((condition) =>
    evaluateSceneCondition(
      telemetry?.[condition.field],
      condition.operator,
      condition.value
    )
  );
}

function createAuditAction(
  source: SceneRuntimeSource,
  matchedConditions: boolean
): string {
  if (source === "manual") {
    return matchedConditions
      ? "scene.manual_run.executed"
      : "scene.manual_run.skipped";
  }

  return matchedConditions
    ? `scene.runtime.${source}.executed`
    : `scene.runtime.${source}.skipped`;
}

function createHistoryEntry(
  scene: SceneRecord,
  source: SceneRuntimeSource,
  triggeredAt: string,
  matchedConditions: boolean,
  executedActions: string[],
  telemetry: SceneTelemetrySnapshot | undefined,
  dedupeKey: string | undefined
): SceneRunHistoryEntry {
  return {
    runId: createRunId(),
    sceneId: scene.sceneId,
    source,
    triggeredAt,
    sceneStatus: scene.status,
    matchedConditions,
    executedActions,
    ...optionalProp("telemetry", telemetry),
    ...optionalProp("dedupeKey", dedupeKey)
  };
}

function executeSceneRuntime(
  scene: SceneRecord,
  input: {
    source: SceneRuntimeSource;
    actorId: string;
    triggeredAt: string;
    homeRole?: HomeAccessRole | undefined;
    telemetry?: SceneTelemetrySnapshot | undefined;
    dedupeKey?: string | undefined;
  }
): SceneRunResponse {
  assertRestrictedActionPermission(scene.actions, input.homeRole);

  const matchedConditions = evaluateConditions(scene, input.telemetry);
  const updatedScene: SceneRecord = {
    ...scene,
    updatedAt: input.triggeredAt,
    lastRunAt: input.triggeredAt,
    lastRunStatus: matchedConditions ? "success" : "skipped"
  };
  const savedScene = sceneRepository.save(updatedScene);
  const executedActions = matchedConditions
    ? savedScene.actions.map((action: SceneAction) => action.actionId)
    : [];

  appendRunHistory(
    createHistoryEntry(
      savedScene,
      input.source,
      input.triggeredAt,
      matchedConditions,
      executedActions,
      input.telemetry,
      input.dedupeKey
    )
  );

  writeAudit(
    savedScene.sceneId,
    input.actorId,
    createAuditAction(input.source, matchedConditions),
    {
      executedActions,
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {})
    }
  );

  return {
    sceneId: savedScene.sceneId,
    matchedConditions,
    executedActions,
    scene: savedScene
  };
}

function hasScheduleTrigger(scene: SceneRecord): boolean {
  return scene.triggers.some((trigger) => trigger.type === "schedule");
}

function getScheduleDedupeKey(
  schedule: SceneSchedule | undefined,
  occurredAt: string
): string | undefined {
  if (!schedule) {
    return undefined;
  }

  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>(
    (current, part) => {
      if (part.type !== "literal") {
        current[part.type] = part.value;
      }

      return current;
    },
    {}
  );
  const dayIndex = weekdayIndexByName[parts.weekday ?? ""];
  const localTime = `${parts.hour ?? ""}:${parts.minute ?? ""}`;

  if (
    dayIndex === undefined ||
    !schedule.daysOfWeek.includes(dayIndex) ||
    localTime !== schedule.time
  ) {
    return undefined;
  }

  return `${parts.year}-${parts.month}-${parts.day}T${localTime}@${schedule.timezone}`;
}

function sceneHasMatchingThresholdTrigger(
  scene: SceneRecord,
  payload: TelemetryRuntimePayload
): boolean {
  return scene.triggers.some((trigger) => {
    if (
      trigger.type !== "device_threshold" ||
      !trigger.deviceId ||
      !trigger.metricKey ||
      !trigger.comparator ||
      trigger.threshold === undefined
    ) {
      return false;
    }

    if (trigger.deviceId !== payload.deviceId) {
      return false;
    }

    return evaluateSceneCondition(
      payload.telemetry[trigger.metricKey],
      trigger.comparator,
      trigger.threshold
    );
  });
}

function hasRunForScheduleWindow(sceneId: string, dedupeKey: string): boolean {
  return sceneRunHistoryRepository
    .list(sceneId)
    .some((entry) => entry.source === "schedule" && entry.dedupeKey === dedupeKey);
}

function listActiveScenesForHome(homeId: string): SceneRecord[] {
  return sceneRepository
    .list()
    .filter((scene) => scene.homeId === homeId && scene.status === "active");
}

function toBatchResponse(runs: SceneRunResponse[]): SceneRuntimeBatchResponse {
  return {
    evaluatedSceneCount: runs.length,
    matchedRunCount: runs.filter((run) => run.matchedConditions).length,
    runs
  };
}

export function listScenes(context: SceneRequestContext): SceneRecord[] {
  return sceneRepository.list().filter((scene) => {
    if (context.homeId && scene.homeId !== context.homeId) {
      return false;
    }

    if (context.userId && scene.ownerUserId !== context.userId) {
      return false;
    }

    return true;
  });
}

export function getScene(
  sceneId: string,
  context: SceneRequestContext
): SceneRecord {
  return assertAccess(requireScene(sceneId), context);
}

export function listSceneRunHistory(
  sceneId: string,
  context: SceneRequestContext
): SceneRunHistoryEntry[] {
  const scene = assertAccess(requireScene(sceneId), context);
  return sceneRunHistoryRepository.list(scene.sceneId);
}

export function createScene(
  payload: CreateScenePayload,
  context: SceneRequestContext
): SceneRecord {
  const actorId = requireActorId(context);
  const homeId = requireHomeId(context);
  const actions = payload.actions.map(toActionRecord);

  assertRestrictedActionPermission(actions, context.homeRole);

  const timestamp = new Date().toISOString();
  const record: SceneRecord = {
    sceneId: createSceneId(),
    homeId,
    ownerUserId: actorId,
    name: payload.name.trim(),
    status: payload.status ?? "draft",
    triggers: payload.triggers.map(toTriggerRecord),
    conditions: payload.conditions.map(toConditionRecord),
    actions,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastRunStatus: "idle",
    ...optionalProp("schedule", payload.schedule)
  };

  const saved = sceneRepository.save(record);
  writeAudit(saved.sceneId, actorId, "scene.created", {
    status: saved.status
  });
  return saved;
}

export function patchScene(
  sceneId: string,
  patch: ScenePatchPayload,
  context: SceneRequestContext
): SceneRecord {
  const actorId = requireActorId(context);
  const existing = assertAccess(requireScene(sceneId), context);
  const nextActions = patch.actions
    ? patch.actions.map(toActionRecord)
    : existing.actions;

  assertRestrictedActionPermission(nextActions, context.homeRole);

  const updated: SceneRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
    ...optionalProp("name", patch.name?.trim()),
    ...optionalProp("status", patch.status),
    ...(patch.triggers ? { triggers: patch.triggers.map(toTriggerRecord) } : {}),
    ...(patch.conditions
      ? { conditions: patch.conditions.map(toConditionRecord) }
      : {}),
    ...(patch.actions ? { actions: nextActions } : {}),
    ...(patch.schedule ? { schedule: patch.schedule } : {})
  };

  const saved = sceneRepository.save(updated);
  writeAudit(saved.sceneId, actorId, "scene.updated");
  return saved;
}

export function runSceneManually(
  sceneId: string,
  payload: ManualRunPayload,
  context: SceneRequestContext
): SceneRunResponse {
  const actorId = requireActorId(context);
  const existing = assertAccess(requireScene(sceneId), context);

  if (existing.status === "paused") {
    throw new SceneModuleError(409, "Paused scenes cannot be run manually");
  }

  return executeSceneRuntime(existing, {
    source: "manual",
    actorId,
    triggeredAt: new Date().toISOString(),
    homeRole: context.homeRole,
    telemetry: payload.telemetry
  });
}

export function evaluateScenesByTelemetry(
  payload: TelemetryRuntimePayload,
  context: SceneRequestContext
): SceneRuntimeBatchResponse {
  const actorId = resolveActorId(context);
  const homeId = requireHomeId(context);
  const triggeredAt = payload.occurredAt ?? new Date().toISOString();
  const runs = listActiveScenesForHome(homeId)
    .filter((scene) => sceneHasMatchingThresholdTrigger(scene, payload))
    .map((scene) =>
      executeSceneRuntime(scene, {
        source: "device_threshold",
        actorId,
        triggeredAt,
        homeRole: context.homeRole,
        telemetry: payload.telemetry
      })
    );

  return toBatchResponse(runs);
}

export function evaluateScheduledScenes(
  payload: ScheduleRuntimePayload,
  context: SceneRequestContext
): SceneRuntimeBatchResponse {
  const actorId = resolveActorId(context);
  const homeId = requireHomeId(context);
  const triggeredAt = payload.occurredAt ?? new Date().toISOString();
  const scheduleRuns = listActiveScenesForHome(homeId)
    .map((scene) => ({
      scene,
      dedupeKey:
        hasScheduleTrigger(scene) && scene.schedule
          ? getScheduleDedupeKey(scene.schedule, triggeredAt)
          : undefined
    }))
    .filter(
      (
        candidate
      ): candidate is {
        scene: SceneRecord;
        dedupeKey: string;
      } =>
        candidate.dedupeKey !== undefined &&
        !hasRunForScheduleWindow(candidate.scene.sceneId, candidate.dedupeKey)
    )
    .map(({ scene, dedupeKey }) =>
      executeSceneRuntime(scene, {
        source: "schedule",
        actorId,
        triggeredAt,
        homeRole: context.homeRole,
        dedupeKey
      })
    );

  return toBatchResponse(scheduleRuns);
}

export const sceneTesting = {
  reset() {
    sceneRepository.reset();
    sceneAuditRepository.reset();
    sceneRunHistoryRepository.reset();
  },
  listAudit(sceneId: string) {
    return sceneAuditRepository.list(sceneId);
  },
  listRunHistory(sceneId: string) {
    return sceneRunHistoryRepository.list(sceneId);
  }
};
