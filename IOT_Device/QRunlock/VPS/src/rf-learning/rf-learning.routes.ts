import { Router, type Router as ExpressRouter } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { createRfLearningControllers } from "./rf-learning.controller";

// Mounted at /api/v1/devices — device-scoped actions, same nesting
// convention as token-dispenser.routes.ts's /:deviceId/token-dispenser/...
export function createRfLearningDeviceActionRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createRfLearningControllers(deps);

  router.post("/:deviceId/qrunlock/rf-learning/start", controllers.start);
  router.post("/:deviceId/qrunlock/rf-learning/cancel", controllers.cancel);
  router.get("/:deviceId/qrunlock/rf-learning/status", controllers.status);

  return router;
}
