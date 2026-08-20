import { Router, type Router as ExpressRouter } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { createDestinationControllers } from "./destination.controller";

// Mounted at /api/v1/streamer by index.ts.
export function createDestinationRouter(deps: SmartStreamerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createDestinationControllers(deps);

  router.get("/destinations", controllers.list);
  router.post("/destinations", controllers.create);
  router.get("/destinations/:destinationId", controllers.get);
  router.put("/destinations/:destinationId", controllers.update);
  router.delete("/destinations/:destinationId", controllers.remove);
  router.post("/destinations/:destinationId/validate", controllers.validate);

  return router;
}
