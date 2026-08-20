import { Router, type Router as ExpressRouter } from "express";

import { createCameraRouter } from "./cameras/camera.routes";
import { createDestinationRouter } from "./destinations/destination.routes";
import { createDeviceRouter } from "./devices/device.routes";
import type { SmartStreamerPlatformDeps } from "./platform-deps";
import { createScheduleRouter } from "./schedules/schedule.routes";
import { createSessionDeviceActionRouter, createSessionTenantRouter } from "./sessions/session.routes";

export type { SmartStreamerPlatformDeps } from "./platform-deps";

/**
 * Tenant-scoped router (JWT-authenticated, homeId-scoped resources) for
 * /api/v1/streamer, mirroring how sceneRouter is mounted in app.ts.
 */
export function createSmartStreamerRouter(deps: SmartStreamerPlatformDeps): ExpressRouter {
  const router = Router();

  router.use(createDeviceRouter(deps));
  router.use(createCameraRouter(deps));
  router.use(createDestinationRouter(deps));
  router.use(createSessionTenantRouter(deps));
  router.use(createScheduleRouter(deps));

  return router;
}

/**
 * Device-scoped action router for /api/v1/devices — same nesting
 * convention every other product module uses (token-dispenser.routes.ts
 * etc.): actions live under /:deviceId/streamer/..., not /streamer/....
 */
export function createSmartStreamerDeviceActionRouter(
  deps: SmartStreamerPlatformDeps
): ExpressRouter {
  const router = Router();

  router.use(createSessionDeviceActionRouter(deps));

  return router;
}
