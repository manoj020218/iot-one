import { Router, type Router as ExpressRouter } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { createRfRemoteControllers } from "./rf-remote.controller";

// Mounted at /api/v1/qrunlock by index.ts — tenant-scoped resource routes.
export function createRfRemoteRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createRfRemoteControllers(deps);

  router.get("/devices/:deviceId/rf-remotes", controllers.list);
  router.post("/devices/:deviceId/rf-remotes", controllers.add);
  router.patch("/devices/:deviceId/rf-remotes/:remoteId", controllers.rename);
  router.delete("/devices/:deviceId/rf-remotes/:remoteId", controllers.remove);

  return router;
}
