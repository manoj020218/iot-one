import { Router, type Router as ExpressRouter } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { createActivityControllers } from "./activity.controller";

// Mounted at /api/v1/qrunlock by index.ts — tenant-scoped resource route.
export function createActivityRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createActivityControllers(deps);

  router.get("/devices/:deviceId/activity", controllers.list);

  return router;
}
