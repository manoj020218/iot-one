import { Router, type Router as ExpressRouter } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createSpeakerGroupControllers } from "./group.controller";

export function createSpeakerGroupRouter(deps: IpSpeakerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createSpeakerGroupControllers(deps);

  router.get("/groups", controllers.listGroups);
  router.post("/groups", controllers.createGroup);
  router.patch("/groups/:groupId", controllers.updateGroup);

  return router;
}
