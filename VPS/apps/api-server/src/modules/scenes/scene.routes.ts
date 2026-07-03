import { Router, type Router as ExpressRouter } from "express";

import {
  createSceneController,
  evaluateScheduleRuntimeController,
  evaluateTelemetryRuntimeController,
  getSceneController,
  listSceneDispatchesController,
  listSceneRunHistoryController,
  listScenesController,
  patchSceneController,
  replaySceneDispatchController,
  runSceneController
} from "./scene.controller";

export const sceneRouter: ExpressRouter = Router();

sceneRouter.get("/", listScenesController);
sceneRouter.post("/", createSceneController);
sceneRouter.post("/runtime/device-threshold", evaluateTelemetryRuntimeController);
sceneRouter.post("/runtime/schedule", evaluateScheduleRuntimeController);
sceneRouter.get("/:sceneId", getSceneController);
sceneRouter.get("/:sceneId/dispatches", listSceneDispatchesController);
sceneRouter.get("/:sceneId/history", listSceneRunHistoryController);
sceneRouter.patch("/:sceneId", patchSceneController);
sceneRouter.post("/:sceneId/run", runSceneController);
sceneRouter.post("/:sceneId/dispatches/:jobId/replay", replaySceneDispatchController);
