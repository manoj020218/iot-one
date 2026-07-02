import {
  createAuditStamp,
  evaluateSceneCondition,
  isRestrictedSceneCommand,
  type HomeAccessRole,
  type SceneAction,
  type SceneCondition,
  type SceneRecord,
  type SceneTrigger
} from "@jenix/shared";

import { sceneAuditRepository, sceneRepository } from "./scene.model";
import type {
  CreateScenePayload,
  ManualRunPayload,
  SceneActionInput,
  SceneAuditEntry,
  SceneConditionInput,
  ScenePatchPayload,
  SceneRequestContext,
  SceneRunResponse,
  SceneTriggerInput
} from "./scene.types";
import { SceneModuleError } from "./scene.types";

function createSceneId(): string {
  return `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNestedId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
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

  assertRestrictedActionPermission(existing.actions, context.homeRole);

  const matchedConditions = evaluateConditions(existing, payload.telemetry);
  const updatedScene: SceneRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
    lastRunAt: new Date().toISOString(),
    lastRunStatus: matchedConditions ? "success" : "skipped"
  };
  const savedScene = sceneRepository.save(updatedScene);

  if (!matchedConditions) {
    writeAudit(savedScene.sceneId, actorId, "scene.manual_run.skipped");

    return {
      sceneId: savedScene.sceneId,
      matchedConditions: false,
      executedActions: [],
      scene: savedScene
    };
  }

  const executedActions = savedScene.actions.map(
    (action: SceneAction) => action.actionId
  );
  writeAudit(savedScene.sceneId, actorId, "scene.manual_run.executed", {
    executedActions
  });

  return {
    sceneId: savedScene.sceneId,
    matchedConditions: true,
    executedActions,
    scene: savedScene
  };
}

export const sceneTesting = {
  reset() {
    sceneRepository.reset();
    sceneAuditRepository.reset();
  },
  listAudit(sceneId: string) {
    return sceneAuditRepository.list(sceneId);
  }
};
