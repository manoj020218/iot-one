import type { SceneRecord } from "@jenix/shared";

const sceneDemoStore = new Map<string, SceneRecord[]>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createKey(userId: string, homeId: string) {
  return `${userId}:${homeId}`;
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

export function resetDemoScenes() {
  sceneDemoStore.clear();
}
