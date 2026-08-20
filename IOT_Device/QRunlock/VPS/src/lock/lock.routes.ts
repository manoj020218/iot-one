import { Router, type Router as ExpressRouter } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { createLockControllers } from "./lock.controller";

// Mounted at /api/v1/devices — device-scoped action, same nesting
// convention as token-dispenser.routes.ts's /:deviceId/token-dispenser/...
export function createLockDeviceActionRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createLockControllers(deps);

  router.post("/:deviceId/qrunlock/unlock", controllers.unlock);

  return router;
}
