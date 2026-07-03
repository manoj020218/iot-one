import {
  ensureDefaultHome,
  evaluateSceneCondition,
  getCurrentHome as getSelectedHome,
  isRestrictedSceneCommand,
  type AuthSession,
  type HomeAccessRole,
  type SceneAction,
  type SceneCondition,
  type SceneRecord,
  type SceneRunResult,
  type SceneSchedule,
  type SceneStatus,
  type SceneTelemetrySnapshot,
  type SceneTrigger
} from "@jenix/shared";

import {
  listDemoScenes,
  resetDemoScenes,
  setDemoScenes,
  upsertDemoScene
} from "./sceneDemoStore";
import { createAuthenticatedHeaders } from "../../../app/apiHeaders";

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

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function createSceneId(): string {
  return `scene-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNestedId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
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

  const scene: SceneRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
    lastRunAt: new Date().toISOString(),
    lastRunStatus: matchedConditions ? "success" : "skipped"
  };

  upsertDemoScene(session.user.userId, currentHome.homeId, scene);

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
    return await fetchJson<SceneRecord[]>(sceneEndpoint, {
      method: "GET",
      headers: createAuthenticatedHeaders(session, {
        homeId: currentHome.homeId
      })
    });
  } catch {
    return listDemoScenes(session.user.userId, currentHome.homeId);
  }
}

export async function getScene(
  session: AuthSession,
  sceneId: string
): Promise<SceneRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<SceneRecord>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch {
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
    return await fetchJson<SceneRecord>(sceneEndpoint, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json",
        homeId: currentHome.homeId
      }),
      body: JSON.stringify(input)
    });
  } catch {
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
    return await fetchJson<SceneRecord>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}`,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify(patch)
      }
    );
  } catch {
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
    return await fetchJson<SceneRunResponse>(
      `${sceneEndpoint}/${encodeURIComponent(sceneId)}/run`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json",
          homeId: currentHome.homeId
        }),
        body: JSON.stringify(input)
      }
    );
  } catch {
    return runFallbackScene(session, sceneId, input);
  }
}

export const sceneApiTesting = {
  reset() {
    resetDemoScenes();
  },
  seedDemoScenes(userId: string, homeId: string, scenes: SceneRecord[]) {
    setDemoScenes(userId, homeId, scenes);
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
  }
};
