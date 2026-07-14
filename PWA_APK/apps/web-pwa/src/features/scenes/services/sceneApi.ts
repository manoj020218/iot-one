import {
  ensureDefaultHome,
  evaluateSceneCondition,
  getCurrentHome as getSelectedHome,
  isRestrictedSceneCommand,
  type AuthSession,
  type HomeAccessRole,
  type SceneAction,
  type SceneActionDispatchRecord,
  type SceneCondition,
  type SceneRecord,
  type SceneRunResult,
  type SceneSchedule,
  type SceneStatus,
  type SceneTelemetrySnapshot,
  type SceneTrigger
} from "@jenix/shared";

import {
  appendDemoSceneDispatches,
  listDemoScenes,
  listDemoSceneDispatches,
  resetDemoScenes,
  setDemoSceneDispatches,
  setDemoScenes,
  upsertDemoScene
} from "./sceneDemoStore";
import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import {
  fetchAuthenticatedJson,
  shouldUseDemoFallback
} from "../../../app/authenticatedRequest";

const sceneEndpoint = "/api/v1/scenes";

export interface SceneTriggerInput extends Omit<SceneTrigger, "triggerId"> {
  triggerId?: string;
}

export interface SceneConditionInput extends Omit<SceneCondition, "conditionId"> {
  conditionId?: string;
}

export interface SceneActionInput extends Omit<SceneAction, "actionId"> {
  actionId?: string;
}

export interface SceneCreateInput {
  name: string;
  status?: SceneStatus;
  triggers: SceneTriggerInput[];
  conditions: SceneConditionInput[];
  actions: SceneActionInput[];
  schedule?: SceneSchedule;
}

export type SceneUpdateInput = Partial<SceneCreateInput>;

export interface SceneManualRunInput {
  telemetry?: SceneTelemetrySnapshot;
}

export interface SceneRunResponse extends SceneRunResult {
  scene: SceneRecord;
}

function clone<T>(value: T): T {
  return structuredClone(value);
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

function getCurrentHome(session: AuthSession) {
  return getSelectedHome(
    ensureDefaultHome(session.homes, session.user.userId),
    session.user.userId,
    session.activeHomeId
  );
}

function getHomeRole(session: AuthSession): HomeAccessRole {
  return getCurrentHome(session).role;
}

function createSceneId(): string {
  return `scene-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNestedId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSceneRunId(): string {
  return `run-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSceneDispatchId(): string {
  return `dispatch-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertRestrictedActionPermission(
  actions: SceneAction[],
  homeRole: HomeAccessRole
) {
  const restrictedAction = actions.find(
    (action) =>
      action.type === "device_command" &&
      action.command &&
      isRestrictedSceneCommand(action.command)
  );

  if (restrictedAction && homeRole !== "owner" && homeRole !== "admin") {
    throw new Error(
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

function createFallbackScene(
  session: AuthSession,
  input: SceneCreateInput
): SceneRecord {
  const currentHome = getCurrentHome(session);
  const actions = input.actions.map(toActionRecord);

  assertRestrictedActionPermission(actions, getHomeRole(session));

  const timestamp = new Date().toISOString();
  const record: SceneRecord = {
    sceneId: createSceneId(),
    homeId: currentHome.homeId,
    ownerUserId: session.user.userId,
    name: input.name.trim(),
    status: input.status ?? "draft",
    triggers: input.triggers.map(toTriggerRecord),
    conditions: input.conditions.map(toConditionRecord),
    actions,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastRunStatus: "idle",
    ...optionalProp("schedule", input.schedule)
  };

  upsertDemoScene(session.user.userId, currentHome.homeId, record);
  return record;
}

function updateFallbackScene(
  session: AuthSession,
  sceneId: string,
  patch: SceneUpdateInput
): SceneRecord {
  const currentHome = getCurrentHome(session);
  const scenes = listDemoScenes(session.user.userId, currentHome.homeId);
  const existing = scenes.find((scene) => scene.sceneId === sceneId);

  if (!existing) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  const actions = patch.actions
    ? patch.actions.map(toActionRecord)
    : existing.actions;

  assertRestrictedActionPermission(actions, getHomeRole(session));

  const nextScene: SceneRecord = {
    ...existing,
    name: patch.name?.trim() || existing.name,
    status: patch.status ?? existing.status,
    triggers: patch.triggers
      ? patch.triggers.map(toTriggerRecord)
      : existing.triggers,
    conditions: patch.conditions
      ? patch.conditions.map(toConditionRecord)
      : existing.conditions,
    actions,
    updatedAt: new Date().toISOString(),
    ...(patch.schedule ? { schedule: patch.schedule } : {}),
    ...(patch.schedule === undefined && existing.schedule
      ? { schedule: existing.schedule }
      : {})
  };

  upsertDemoScene(session.user.userId, currentHome.homeId, nextScene);
  return nextScene;
}

function runFallbackScene(
  session: AuthSession,
  sceneId: string,
  input: SceneManualRunInput
): SceneRunResponse {
  const currentHome = getCurrentHome(session);
  const scenes = listDemoScenes(session.user.userId, currentHome.homeId);
  const existing = scenes.find((scene) => scene.sceneId === sceneId);

  if (!existing) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  if (existing.status === "paused") {
    throw new Error("Paused scenes cannot be run manually");
  }

  assertRestrictedActionPermission(existing.actions, getHomeRole(session));

  const matchedConditions =
    existing.conditions.length === 0 ||
    existing.conditions.every((condition) =>
      evaluateSceneCondition(
        input.telemetry?.[condition.field],
        condition.operator,
        condition.value
      )
    );
  const requestedAt = new Date().toISOString();

  const scene: SceneRecord = {
    ...existing,
    updatedAt: requestedAt,
    lastRunAt: requestedAt,
    lastRunStatus: matchedConditions ? "success" : "skipped"
  };

  upsertDemoScene(session.user.userId, currentHome.homeId, scene);

  if (matchedConditions) {
    const runId = createSceneRunId();
    appendDemoSceneDispatches(
      scene.sceneId,
      scene.actions.map((action) => ({
        jobId: createSceneDispatchId(),
        runId,
        sceneId: scene.sceneId,
        homeId: scene.homeId,
        source: "manual",
        action: clone(action),
        requestedAt,
        attemptCount: 1,
        status: "completed",
        dispatchedAt: requestedAt,
        completedAt: requestedAt
      }))
    );
  }

  return {
    sceneId: scene.sceneId,
    matchedConditions,
    executedActions: matchedConditions
      ? scene.actions.map((action) => action.actionId)
      : [],
    scene
  };
}

export async function listScenes(session: AuthSession): Promise<SceneRecord[]> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<SceneRecord[]>(sceneEndpoint, session, {
      method: "GET",
      headers: createAuthenticatedHeaders(session, {
        homeId: currentHome.homeId
      })
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return listDemoScenes(session.user.userId, currentHome.homeId);
  }
}

export async function getScene(
  session: AuthSession,
  sceneId: string
): Promise<SceneRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<SceneRecord>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}`,
      session,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    const scene = listDemoScenes(session.user.userId, currentHome.homeId).find(
      (item) => item.sceneId === sceneId
    );

    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`);
    }

    return scene;
  }
}

export async function createScene(
  session: AuthSession,
  input: SceneCreateInput
): Promise<SceneRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<SceneRecord>(sceneEndpoint, session, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json",
        homeId: currentHome.homeId
      }),
      body: JSON.stringify(input)
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return createFallbackScene(session, input);
  }
}

export async function updateScene(
  session: AuthSession,
  sceneId: string,
  patch: SceneUpdateInput
): Promise<SceneRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<SceneRecord>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}`,
      session,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify(patch)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return updateFallbackScene(session, sceneId, patch);
  }
}

export async function runSceneManually(
  session: AuthSession,
  sceneId: string,
  input: SceneManualRunInput
): Promise<SceneRunResponse> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<SceneRunResponse>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}/run`,
      session,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify(input)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return runFallbackScene(session, sceneId, input);
  }
}

export async function listSceneDispatches(
  session: AuthSession,
  sceneId: string
): Promise<SceneActionDispatchRecord[]> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<SceneActionDispatchRecord[]>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}/dispatches`,
      session,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return listDemoSceneDispatches(sceneId);
  }
}

export async function replaySceneDispatch(
  session: AuthSession,
  sceneId: string,
  jobId: string
): Promise<SceneActionDispatchRecord> {
  const currentHome = getCurrentHome(session);
  const homeRole = getHomeRole(session);

  if (homeRole === "viewer") {
    throw new Error("Viewer access cannot replay scene dispatches.");
  }

  try {
    return await fetchAuthenticatedJson<SceneActionDispatchRecord>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}/dispatches/${encodeURIComponent(jobId)}/replay`,
      session,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    const existing = listDemoSceneDispatches(sceneId).find((dispatch) => dispatch.jobId === jobId);

    if (!existing) {
      throw new Error(`Scene dispatch job not found: ${jobId}`);
    }

    if (existing.status !== "failed") {
      throw new Error(`Only failed scene dispatch jobs can be replayed: ${jobId}`);
    }

    assertRestrictedActionPermission([existing.action], homeRole);

    const replayedDispatch: SceneActionDispatchRecord = {
      jobId: createSceneDispatchId(),
      runId: existing.runId,
      sceneId: existing.sceneId,
      homeId: existing.homeId,
      source: existing.source,
      action: clone(existing.action),
      requestedAt: new Date().toISOString(),
      attemptCount: 0,
      status: "queued",
      replayedFromJobId: existing.jobId
    };

    appendDemoSceneDispatches(sceneId, [replayedDispatch]);
    return replayedDispatch;
  }
}

export const sceneApiTesting = {
  reset() {
    resetDemoScenes();
  },
  seedDemoScenes(userId: string, homeId: string, scenes: SceneRecord[]) {
    setDemoScenes(userId, homeId, scenes);
  },
  seedDemoDispatches(sceneId: string, dispatches: SceneActionDispatchRecord[]) {
    setDemoSceneDispatches(sceneId, dispatches);
  },
  createDemoScene(input: {
    sceneId: string;
    userId: string;
    homeId: string;
    name: string;
    status?: SceneStatus;
    actions?: SceneActionInput[];
    conditions?: SceneConditionInput[];
    triggers?: SceneTriggerInput[];
    schedule?: SceneSchedule;
    lastRunStatus?: SceneRecord["lastRunStatus"];
  }): SceneRecord {
    const timestamp = new Date("2026-07-02T00:00:00.000Z").toISOString();

    return {
      sceneId: input.sceneId,
      homeId: input.homeId,
      ownerUserId: input.userId,
      name: input.name,
      status: input.status ?? "draft",
      triggers: (input.triggers ?? [{ type: "manual" }]).map(toTriggerRecord),
      conditions: (input.conditions ?? []).map(toConditionRecord),
      actions: (
        input.actions ?? [
          {
            type: "notification",
            message: "Default scene alert"
          }
        ]
      ).map(toActionRecord),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastRunStatus: input.lastRunStatus ?? "idle",
      ...optionalProp("schedule", input.schedule)
    };
  },
  createDemoDispatch(input: {
    jobId: string;
    sceneId: string;
    homeId: string;
    runId?: string;
    source?: SceneActionDispatchRecord["source"];
    action?: SceneActionInput;
    status?: SceneActionDispatchRecord["status"];
    requestedAt?: string;
    attemptCount?: number;
    lastError?: string;
    replayedFromJobId?: string;
  }): SceneActionDispatchRecord {
    const requestedAt = input.requestedAt ?? new Date("2026-07-03T14:00:00.000Z").toISOString();
    const status = input.status ?? "completed";

    return {
      jobId: input.jobId,
      runId: input.runId ?? "run-local-seeded",
      sceneId: input.sceneId,
      homeId: input.homeId,
      source: input.source ?? "manual",
      action: toActionRecord(
        input.action ?? {
          type: "notification",
          message: "Seeded dispatch"
        }
      ),
      requestedAt,
      attemptCount: input.attemptCount ?? (status === "queued" ? 0 : 1),
      status,
      ...(status !== "queued" ? { dispatchedAt: requestedAt } : {}),
      ...(status === "completed" ? { completedAt: requestedAt } : {}),
      ...(status === "failed" ? { failedAt: requestedAt } : {}),
      ...optionalProp("lastError", input.lastError),
      ...optionalProp("replayedFromJobId", input.replayedFromJobId)
    };
  }
};
