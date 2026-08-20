import { Router, type Router as ExpressRouter } from "express";

import { createActivityRouter } from "./activity/activity.routes";
import { createDeviceRouter } from "./devices/device.routes";
import { createLockDeviceActionRouter } from "./lock/lock.routes";
import type { QrunlockPlatformDeps } from "./platform-deps";
import { createRfLearningDeviceActionRouter } from "./rf-learning/rf-learning.routes";
import { createRfRemoteRouter } from "./rf-remotes/rf-remote.routes";
import { createSettingsRouter } from "./settings/settings.routes";

export type { QrunlockPlatformDeps } from "./platform-deps";
export { QRUNLOCK_PID } from "./constants";
export { unlockDevice } from "./lock/lock.service";
export { listActivity } from "./activity/activity.service";
export { getSettings, updateSettings } from "./settings/settings.service";
export type { UpdateSettingsInput } from "./settings/settings.types";

/**
 * Tenant-scoped router (JWT-authenticated, homeId-scoped resources) for
 * /api/v1/qrunlock, mirroring how sceneRouter and
 * createSmartStreamerRouter are mounted in app.ts.
 */
export function createQrunlockRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();

  router.use(createDeviceRouter(deps));
  router.use(createSettingsRouter(deps));
  router.use(createActivityRouter(deps));
  router.use(createRfRemoteRouter(deps));

  return router;
}

/**
 * Device-scoped action router for /api/v1/devices — same nesting
 * convention every other product module uses (token-dispenser.routes.ts
 * etc.): actions live under /:deviceId/qrunlock/..., not /qrunlock/....
 */
export function createQrunlockDeviceActionRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();

  router.use(createLockDeviceActionRouter(deps));
  router.use(createRfLearningDeviceActionRouter(deps));

  return router;
}
