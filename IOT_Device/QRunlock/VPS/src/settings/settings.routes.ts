import { Router, type Router as ExpressRouter } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { createSettingsControllers } from "./settings.controller";

// Mounted at /api/v1/qrunlock by index.ts — tenant-scoped resource routes.
export function createSettingsRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createSettingsControllers(deps);

  router.get("/devices/:deviceId/settings", controllers.get);
  router.put("/devices/:deviceId/settings", controllers.update);

  return router;
}
