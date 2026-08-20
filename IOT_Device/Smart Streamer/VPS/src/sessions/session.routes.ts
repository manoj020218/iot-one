import { Router, type Router as ExpressRouter } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { createSessionControllers } from "./session.controller";

// Mounted at /api/v1/streamer — tenant-scoped read.
export function createSessionTenantRouter(deps: SmartStreamerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createSessionControllers(deps);

  router.get("/sessions/:sessionId", controllers.get);

  return router;
}

// Mounted at /api/v1/devices — device-scoped actions, same nesting
// convention as token-dispenser.routes.ts's /:deviceId/token-dispenser/...
export function createSessionDeviceActionRouter(deps: SmartStreamerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createSessionControllers(deps);

  router.post("/:deviceId/streamer/sessions/start", controllers.start);
  router.post("/:deviceId/streamer/sessions/stop", controllers.stop);
  router.post("/:deviceId/streamer/sessions/force-stop", controllers.forceStop);

  return router;
}
