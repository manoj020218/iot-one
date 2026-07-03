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

import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";
import {
  sceneActionDispatchRepository,
  sceneAuditRepository,
  sceneEvaluationJobRepository,
  sceneRepository,
  sceneRunHistoryRepository
} from "./scene.model";
import type {
  CreateScenePayload,
  ManualRunPayload,
  SceneActionDispatchJob,
  ScheduleRuntimePayload,
  SceneActionInput,
  SceneAuditEntry,
  SceneEvaluationJob,
  SceneConditionInput,
  ScenePatchPayload,
  SceneRequestContext,
  SceneRunHistoryEntry,
  SceneRuntimeQueueJobReceipt,
  SceneRuntimeQueueResponse,
  SceneRunResponse,
  SceneQueuedRuntimeSource,
  SceneRuntimeBatchResponse,
  SceneRuntimeSource,
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

function createDispatchJobId(): string {
  return createNestedId("dispatch");
}

function createEvaluationJobId(): string {
  return createNestedId("runtime");
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
    throw new SceneModuleError(400, "Scene actions require an authenticated user");
  }

  return context.userId;
}

function requireHomeId(context: SceneRequestContext): string {
  if (!context.homeId) {
    throw new SceneModuleError(400, "Scene actions require x-home-id");
  }

  return context.homeId;
}

function requireWriteRole(context: SceneRequestContext) {
  if (context.homeRole === "viewer") {
    throw new SceneModuleError(403, "Viewer access cannot modify scenes");
  }
}

async function resolveContext(
  context: SceneRequestContext
): Promise<SceneRequestContext> {
  try {
    return await resolveHomeAccessContext(context);
  } catch (error) {
    if (error instanceof HomeModuleError) {
      throw new SceneModuleError(error.statusCode, error.message);
    }

    throw error;
  }
}

function resolveActorId(context: SceneRequestContext): string {
  return context.userId ?? runtimeSystemActorId;
}

async function requireScene(sceneId: string): Promise<SceneRecord> {
  const scene = await sceneRepository.get(sceneId);

  if (!scene) {
    throw new SceneModuleError(404, `Scene not found: ${sceneId}`);
  }

  return scene;
}

function assertAccess(
  scene: SceneRecord,
  context: SceneRequestContext,
  access: "read" | "write" = "read"
): SceneRecord {
  if (context.homeId && scene.homeId !== context.homeId) {
    throw new SceneModuleError(403, "Scene access denied for this HOME");
  }

  if (access === "write") {
    requireWriteRole(context);
  }

  if (!context.homeRole && context.userId && scene.ownerUserId !== context.userId) {
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

async function writeAudit(
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

  await sceneAuditRepository.append(entry);
}

async function appendRunHistory(entry: SceneRunHistoryEntry): Promise<boolean> {
  return sceneRunHistoryRepository.append(entry);
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
  runId: string,
  scene: SceneRecord,
  source: SceneRuntimeSource,
  triggeredAt: string,
  matchedConditions: boolean,
  executedActions: string[],
  telemetry: SceneTelemetrySnapshot | undefined,
  dedupeKey: string | undefined
): SceneRunHistoryEntry {
  return {
    runId,
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

function createDispatchJobs(
  scene: SceneRecord,
  runId: string,
  source: SceneRuntimeSource,
  requestedAt: string
): SceneActionDispatchJob[] {
  return scene.actions.map((action) => ({
    jobId: createDispatchJobId(),
    runId,
    sceneId: scene.sceneId,
    homeId: scene.homeId,
    source,
    action,
    requestedAt,
    attemptCount: 0,
    status: "queued"
  }));
}

function createRuntimeQueueResponse(
  jobs: SceneEvaluationJob[]
): SceneRuntimeQueueResponse {
  return {
    acceptedCount: jobs.length,
    jobs: jobs.map(
      (job): SceneRuntimeQueueJobReceipt => ({
        jobId: job.jobId,
        source: job.source,
        homeId: job.homeId,
        status: "queued",
        queuedAt: job.requestedAt
      })
    )
  };
}

function createEvaluationJob(input: {
  source: SceneQueuedRuntimeSource;
  homeId: string;
  occurredAt: string;
  deviceId?: string;
  telemetry?: SceneTelemetrySnapshot;
}): SceneEvaluationJob {
  return {
    jobId: createEvaluationJobId(),
    source: input.source,
    homeId: input.homeId,
    requestedAt: new Date().toISOString(),
    occurredAt: input.occurredAt,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.telemetry ? { telemetry: input.telemetry } : {}),
    attemptCount: 0,
    status: "queued"
  };
}

async function executeSceneRuntime(
  scene: SceneRecord,
  input: {
    source: SceneRuntimeSource;
    actorId: string;
    triggeredAt: string;
    homeRole?: HomeAccessRole | undefined;
    telemetry?: SceneTelemetrySnapshot | undefined;
    dedupeKey?: string | undefined;
  }
): Promise<SceneRunResponse | null> {
  assertRestrictedActionPermission(scene.actions, input.homeRole);

  const matchedConditions = evaluateConditions(scene, input.telemetry);
  const runId = createRunId();
  const executedActions = matchedConditions
    ? scene.actions.map((action: SceneAction) => action.actionId)
    : [];
  const historyEntry = createHistoryEntry(
    runId,
    scene,
    input.source,
    input.triggeredAt,
    matchedConditions,
    executedActions,
    input.telemetry,
    input.dedupeKey
  );

  if (input.source === "schedule") {
    const inserted = await appendRunHistory(historyEntry);

    if (!inserted) {
      return null;
    }
  }

  const updatedScene: SceneRecord = {
    ...scene,
    updatedAt: input.triggeredAt,
    lastRunAt: input.triggeredAt,
    lastRunStatus: matchedConditions ? "success" : "skipped"
  };
  const savedScene = await sceneRepository.save(updatedScene);

  if (input.source !== "schedule") {
    await appendRunHistory({
      ...historyEntry,
      sceneStatus: savedScene.status
    });
  }

  if (matchedConditions && savedScene.actions.length > 0) {
    await sceneActionDispatchRepository.enqueue(
      createDispatchJobs(savedScene, runId, input.source, input.triggeredAt)
    );
  }

  await writeAudit(
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

async function listActiveScenesForHome(homeId: string): Promise<SceneRecord[]> {
  return (await sceneRepository.list()).filter(
    (scene) => scene.homeId === homeId && scene.status === "active"
  );
}

export async function listActiveSceneHomeIds(): Promise<string[]> {
  return Array.from(
    new Set(
      (await sceneRepository.list())
        .filter(
          (scene) =>
            scene.status === "active" && hasScheduleTrigger(scene) && Boolean(scene.schedule)
        )
        .map((scene) => scene.homeId)
    )
  );
}

function toBatchResponse(runs: SceneRunResponse[]): SceneRuntimeBatchResponse {
  return {
    evaluatedSceneCount: runs.length,
    matchedRunCount: runs.filter((run) => run.matchedConditions).length,
    runs
  };
}

export async function listScenes(
  context: SceneRequestContext
): Promise<SceneRecord[]> {
  const resolvedContext = await resolveContext(context);

  return (await sceneRepository.list()).filter((scene) => {
    if (resolvedContext.homeId && scene.homeId !== resolvedContext.homeId) {
      return false;
    }

    if (
      !resolvedContext.homeRole &&
      resolvedContext.userId &&
      scene.ownerUserId !== resolvedContext.userId
    ) {
      return false;
    }

    return true;
  });
}

export async function getScene(
  sceneId: string,
  context: SceneRequestContext
): Promise<SceneRecord> {
  return assertAccess(await requireScene(sceneId), await resolveContext(context));
}

export async function listSceneRunHistory(
  sceneId: string,
  context: SceneRequestContext
): Promise<SceneRunHistoryEntry[]> {
  const scene = assertAccess(await requireScene(sceneId), await resolveContext(context));
  return sceneRunHistoryRepository.list(scene.sceneId);
}

export async function createScene(
  payload: CreateScenePayload,
  context: SceneRequestContext
): Promise<SceneRecord> {
  const resolvedContext = await resolveContext(context);
  const actorId = requireActorId(resolvedContext);
  const homeId = requireHomeId(resolvedContext);
  requireWriteRole(resolvedContext);
  const actions = payload.actions.map(toActionRecord);

  assertRestrictedActionPermission(actions, resolvedContext.homeRole);

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

  const saved = await sceneRepository.save(record);
  await writeAudit(saved.sceneId, actorId, "scene.created", {
    status: saved.status
  });
  return saved;
}

export async function patchScene(
  sceneId: string,
  patch: ScenePatchPayload,
  context: SceneRequestContext
): Promise<SceneRecord> {
  const resolvedContext = await resolveContext(context);
  const actorId = requireActorId(resolvedContext);
  const existing = assertAccess(
    await requireScene(sceneId),
    resolvedContext,
    "write"
  );
  const nextActions = patch.actions
    ? patch.actions.map(toActionRecord)
    : existing.actions;

  assertRestrictedActionPermission(nextActions, resolvedContext.homeRole);

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

  const saved = await sceneRepository.save(updated);
  await writeAudit(saved.sceneId, actorId, "scene.updated");
  return saved;
}

export async function runSceneManually(
  sceneId: string,
  payload: ManualRunPayload,
  context: SceneRequestContext
): Promise<SceneRunResponse> {
  const resolvedContext = await resolveContext(context);
  const actorId = requireActorId(resolvedContext);
  const existing = assertAccess(
    await requireScene(sceneId),
    resolvedContext,
    "write"
  );

  if (existing.status === "paused") {
    throw new SceneModuleError(409, "Paused scenes cannot be run manually");
  }

  const result = await executeSceneRuntime(existing, {
    source: "manual",
    actorId,
    triggeredAt: new Date().toISOString(),
    homeRole: resolvedContext.homeRole,
    telemetry: payload.telemetry
  });

  if (!result) {
    throw new SceneModuleError(500, "Manual scene run did not produce a result");
  }

  return result;
}

export async function evaluateScenesByTelemetry(
  payload: TelemetryRuntimePayload,
  context: SceneRequestContext
): Promise<SceneRuntimeBatchResponse> {
  const resolvedContext = await resolveContext(context);
  const actorId = resolveActorId(resolvedContext);
  const homeId = requireHomeId(resolvedContext);
  const triggeredAt = payload.occurredAt ?? new Date().toISOString();
  const candidateScenes = (await listActiveScenesForHome(homeId)).filter((scene) =>
    sceneHasMatchingThresholdTrigger(scene, payload)
  );
  const runtimeResults = await Promise.all(
    candidateScenes.map((scene) =>
      executeSceneRuntime(scene, {
        source: "device_threshold",
        actorId,
        triggeredAt,
        homeRole: resolvedContext.homeRole,
        telemetry: payload.telemetry
      })
    )
  );

  return toBatchResponse(
    runtimeResults.filter(
      (result): result is SceneRunResponse => result !== null
    )
  );
}

export async function enqueueSceneEvaluationByTelemetry(
  payload: TelemetryRuntimePayload,
  context: SceneRequestContext
): Promise<SceneRuntimeQueueResponse> {
  const resolvedContext = await resolveContext(context);
  const homeId = requireHomeId(resolvedContext);
  const occurredAt = payload.occurredAt ?? new Date().toISOString();
  const jobs = [
    createEvaluationJob({
      source: "device_threshold",
      homeId,
      occurredAt,
      deviceId: payload.deviceId,
      telemetry: payload.telemetry
    })
  ];

  await sceneEvaluationJobRepository.enqueue(jobs);
  return createRuntimeQueueResponse(jobs);
}

export async function evaluateScheduledScenes(
  payload: ScheduleRuntimePayload,
  context: SceneRequestContext
): Promise<SceneRuntimeBatchResponse> {
  const resolvedContext = await resolveContext(context);
  const actorId = resolveActorId(resolvedContext);
  const homeId = requireHomeId(resolvedContext);
  const triggeredAt = payload.occurredAt ?? new Date().toISOString();
  const scheduleCandidates = (await listActiveScenesForHome(homeId))
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
      } => candidate.dedupeKey !== undefined
    );
  const runtimeResults = await Promise.all(
    scheduleCandidates.map(({ scene, dedupeKey }) =>
      executeSceneRuntime(scene, {
        source: "schedule",
        actorId,
        triggeredAt,
        homeRole: resolvedContext.homeRole,
        dedupeKey
      })
    )
  );

  return toBatchResponse(
    runtimeResults.filter(
      (result): result is SceneRunResponse => result !== null
    )
  );
}

export async function enqueueScheduledSceneEvaluation(
  payload: ScheduleRuntimePayload,
  context: SceneRequestContext
): Promise<SceneRuntimeQueueResponse> {
  const resolvedContext = await resolveContext(context);
  const homeId = requireHomeId(resolvedContext);
  const occurredAt = payload.occurredAt ?? new Date().toISOString();
  const jobs = [
    createEvaluationJob({
      source: "schedule",
      homeId,
      occurredAt
    })
  ];

  await sceneEvaluationJobRepository.enqueue(jobs);
  return createRuntimeQueueResponse(jobs);
}

export const sceneTesting = {
  async reset() {
    await sceneRepository.reset();
    await sceneAuditRepository.reset();
    await sceneRunHistoryRepository.reset();
    await sceneActionDispatchRepository.reset();
    await sceneEvaluationJobRepository.reset();
  },
  listAudit(sceneId: string) {
    return sceneAuditRepository.list(sceneId);
  },
  listRunHistory(sceneId: string) {
    return sceneRunHistoryRepository.list(sceneId);
  },
  listActionDispatches(sceneId: string) {
    return sceneActionDispatchRepository.listByScene(sceneId);
  },
  listEvaluationJobs(homeId: string) {
    return sceneEvaluationJobRepository.listByHome(homeId);
  }
};
