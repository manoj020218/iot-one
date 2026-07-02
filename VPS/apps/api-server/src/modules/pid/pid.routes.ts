import { Router, type Router as ExpressRouter } from "express";

import {
  approvePidController,
  archivePidController,
  createPidController,
  getPidController,
  listPidController,
  updatePidController
} from "./pid.controller";

export const pidRouter: ExpressRouter = Router();

pidRouter.get("/", listPidController);
pidRouter.post("/", createPidController);
pidRouter.get("/:pid", getPidController);
pidRouter.patch("/:pid", updatePidController);
pidRouter.post("/:pid/approve", approvePidController);
pidRouter.post("/:pid/archive", archivePidController);
