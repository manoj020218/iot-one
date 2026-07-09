import type { SceneActionDispatchRecord, SceneRecord } from "@jenix/shared";

const sceneDemoStore = new Map<string, SceneRecord[]>();
const sceneDispatchDemoStore = new Map<string, SceneActionDispatchRecord[]>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createKey(userId: string, homeId: string) {
  return `${userId}:${homeId}`;
}

function sortNewestDispatchFirst(
  dispatches: SceneActionDispatchRecord[]
): SceneActionDispatchRecord[] {
  return [...dispatches].sort((left, right) =>
    right.requestedAt.localeCompare(left.requestedAt)
  );
}

export function listDemoScenes(userId: string, homeId: string): SceneRecord[] {
  return clone(sceneDemoStore.get(createKey(userId, homeId)) ?? []);
}

export function setDemoScenes(userId: string, homeId: string, scenes: SceneRecord[]) {
  sceneDemoStore.set(createKey(userId, homeId), clone(scenes));
}

export function upsertDemoScene(userId: string, homeId: string, scene: SceneRecord) {
  const scenes = listDemoScenes(userId, homeId);
  const nextScenes = [
    scene,
    ...scenes.filter((item) => item.sceneId !== scene.sceneId)
  ];

  setDemoScenes(userId, homeId, nextScenes);
}

export function listDemoSceneDispatches(sceneId: string): SceneActionDispatchRecord[] {
  return clone(sortNewestDispatchFirst(sceneDispatchDemoStore.get(sceneId) ?? []));
}

export function setDemoSceneDispatches(
  sceneId: string,
  dispatches: SceneActionDispatchRecord[]
) {
  sceneDispatchDemoStore.set(sceneId, clone(sortNewestDispatchFirst(dispatches)));
}

export function appendDemoSceneDispatches(
  sceneId: string,
  dispatches: SceneActionDispatchRecord[]
) {
  setDemoSceneDispatches(sceneId, [
    ...listDemoSceneDispatches(sceneId),
    ...dispatches
  ]);
}

export function resetDemoScenes() {
  sceneDemoStore.clear();
  sceneDispatchDemoStore.clear();
}
