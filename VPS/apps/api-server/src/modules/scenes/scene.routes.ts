import { Router, type Router as ExpressRouter } from "express";

import {
  createSceneController,
  getSceneController,
  listScenesController,
  patchSceneController,
  runSceneController
} from "./scene.controller";

export const sceneRouter: ExpressRouter = Router();

sceneRouter.get("/", listScenesController);
sceneRouter.post("/", createSceneController);
sceneRouter.get("/:sceneId", getSceneController);
sceneRouter.patch("/:sceneId", patchSceneController);
sceneRouter.post("/:sceneId/run", runSceneController);
