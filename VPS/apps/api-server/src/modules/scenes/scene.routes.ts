import { Router, type Router as ExpressRouter } from "express";

import {
  createSceneController,
  evaluateScheduleRuntimeController,
  evaluateTelemetryRuntimeController,
  getSceneController,
  listSceneRunHistoryController,
  listScenesController,
  patchSceneController,
  runSceneController
} from "./scene.controller";

export const sceneRouter: ExpressRouter = Router();

sceneRouter.get("/", listScenesController);
sceneRouter.post("/", createSceneController);
sceneRouter.post("/runtime/device-threshold", evaluateTelemetryRuntimeController);
sceneRouter.post("/runtime/schedule", evaluateScheduleRuntimeController);
sceneRouter.get("/:sceneId", getSceneController);
sceneRouter.get("/:sceneId/history", listSceneRunHistoryController);
sceneRouter.patch("/:sceneId", patchSceneController);
sceneRouter.post("/:sceneId/run", runSceneController);
