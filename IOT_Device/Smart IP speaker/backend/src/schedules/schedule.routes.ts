import { Router, type Router as ExpressRouter } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createSpeakerScheduleControllers } from "./schedule.controller";

export function createSpeakerScheduleRouter(
  deps: IpSpeakerPlatformDeps
): ExpressRouter {
  const router = Router();
  const controllers = createSpeakerScheduleControllers(deps);

  router.get("/schedules", controllers.listSchedules);
  router.get("/schedules/:scheduleId", controllers.getSchedule);
  router.post("/schedules", controllers.createSchedule);
  router.patch("/schedules/:scheduleId", controllers.updateSchedule);
  router.get("/schedules/:scheduleId/executions", controllers.listExecutions);
  router.post("/schedules/:scheduleId/execute", controllers.executeNow);

  return router;
}
