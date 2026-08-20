import type { NextFunction, Request, Response } from "express";
import type {
  DeviceRecord,
  DeviceUiCommandAckRecord,
  DeviceUiCommandRequest,
  HomeAccessRole,
  SceneAction,
  SceneCondition,
  SceneRecord,
  SceneSchedule,
  SceneStatus,
  SceneTrigger
} from "@jenix/shared";

/**
 * This is the ONLY contract this package has with the rest of the
 * platform. Every field here is structurally identical to the real
 * function/type it stands in for in api-server (device.service.ts,
 * scene.service.ts, request-auth.ts) — api-server passes its actual
 * functions in, this package never imports api-server's files directly.
 * See IOT_Device/Smart Streamer/VPS/README.md for why.
 */

export interface DeviceRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface SceneRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export type SceneTriggerInput = Omit<SceneTrigger, "triggerId"> & { triggerId?: string };
export type SceneConditionInput = Omit<SceneCondition, "conditionId"> & { conditionId?: string };
export type SceneActionInput = Omit<SceneAction, "actionId"> & { actionId?: string };

export interface CreateSceneInput {
  name: string;
  status?: SceneStatus;
  triggers: SceneTriggerInput[];
  conditions: SceneConditionInput[];
  actions: SceneActionInput[];
  schedule?: SceneSchedule;
}

export interface PatchSceneInput {
  name?: string;
  status?: SceneStatus;
  actions?: SceneActionInput[];
  schedule?: SceneSchedule;
}

export interface SmartStreamerPlatformDeps {
  // Auth — from infrastructure/http/request-auth.ts
  requireAuthenticatedUser: (request: Request, response: Response, next: NextFunction) => void;
  requireAuthenticatedRequestUser: (request: Request) => { userId: string };
  readHomeIdFromRequest: (request: Request) => string | undefined;

  // Device registry — from modules/devices/device.service.ts
  listDevices: (context: DeviceRequestContext) => Promise<DeviceRecord[]>;
  getDevice: (deviceId: string, context: DeviceRequestContext) => Promise<DeviceRecord>;
  dispatchDeviceUiCommand: (
    deviceId: string,
    payload: DeviceUiCommandRequest,
    context: DeviceRequestContext
  ) => Promise<DeviceUiCommandAckRecord>;

  // Scheduling — from modules/scenes/scene.service.ts. Every Smart Streamer
  // schedule becomes a pair of these (see schedules/streamerSchedule.service.ts).
  createScene: (payload: CreateSceneInput, context: SceneRequestContext) => Promise<SceneRecord>;
  patchScene: (
    sceneId: string,
    patch: PatchSceneInput,
    context: SceneRequestContext
  ) => Promise<SceneRecord>;
  deleteScene: (sceneId: string, context: SceneRequestContext) => Promise<{ sceneId: string }>;
  listScenes: (context: SceneRequestContext) => Promise<SceneRecord[]>;
  runSceneManually: (
    sceneId: string,
    payload: Record<string, unknown>,
    context: SceneRequestContext
  ) => Promise<{ sceneId: string }>;
}
