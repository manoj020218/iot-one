import { Router, type Router as ExpressRouter } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { createScheduleControllers } from "./schedule.controller";

// Mounted at /api/v1/streamer by index.ts.
export function createScheduleRouter(deps: SmartStreamerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createScheduleControllers(deps);

  router.get("/schedules", controllers.list);
  router.post("/schedules", controllers.create);
  router.get("/schedules/:scheduleId", controllers.get);
  router.put("/schedules/:scheduleId", controllers.update);
  router.delete("/schedules/:scheduleId", controllers.remove);
  router.post("/schedules/:scheduleId/duplicate", controllers.duplicate);
  router.post("/schedules/:scheduleId/run-now", controllers.runNow);

  return router;
}
