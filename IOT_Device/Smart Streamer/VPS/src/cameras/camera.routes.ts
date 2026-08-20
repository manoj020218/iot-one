import { Router, type Router as ExpressRouter } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { createCameraControllers } from "./camera.controller";

// Mounted at /api/v1/streamer by index.ts.
export function createCameraRouter(deps: SmartStreamerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createCameraControllers(deps);

  router.get("/cameras", controllers.list);
  router.post("/cameras", controllers.create);
  router.get("/cameras/:cameraId", controllers.get);
  router.put("/cameras/:cameraId", controllers.update);
  router.delete("/cameras/:cameraId", controllers.remove);
  router.post("/cameras/:cameraId/assign", controllers.assign);
  router.post("/cameras/:cameraId/test", controllers.startTest);
  router.get("/cameras/:cameraId/test/:testId", controllers.getTest);

  return router;
}
