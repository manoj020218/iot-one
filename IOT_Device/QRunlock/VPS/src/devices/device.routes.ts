import { Router, type Router as ExpressRouter } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { createDeviceControllers } from "./device.controller";

// Mounted at /api/v1/qrunlock by index.ts — tenant-scoped resource routes.
export function createDeviceRouter(deps: QrunlockPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createDeviceControllers(deps);

  router.get("/devices", controllers.listDevices);
  router.get("/devices/:deviceId", controllers.getDevice);

  return router;
}
