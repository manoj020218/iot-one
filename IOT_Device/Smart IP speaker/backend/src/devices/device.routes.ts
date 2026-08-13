import { Router, type Router as ExpressRouter } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createSpeakerDeviceControllers } from "./device.controller";

export function createSpeakerDeviceRouter(deps: IpSpeakerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createSpeakerDeviceControllers(deps);

  router.get("/devices", controllers.listDevices);
  router.get("/devices/:deviceId", controllers.getDevice);

  return router;
}
