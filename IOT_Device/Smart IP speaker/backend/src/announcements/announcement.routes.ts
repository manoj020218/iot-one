import { Router, type Router as ExpressRouter } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createAnnouncementControllers } from "./announcement.controller";

export function createAnnouncementTenantRouter(
  deps: IpSpeakerPlatformDeps
): ExpressRouter {
  const router = Router();
  const controllers = createAnnouncementControllers(deps);

  router.get("/announcements/recent", controllers.listRecent);
  router.post("/groups/:groupId/announce", controllers.announceGroup);

  return router;
}

export function createAnnouncementDeviceActionRouter(
  deps: IpSpeakerPlatformDeps
): ExpressRouter {
  const router = Router();
  const controllers = createAnnouncementControllers(deps);

  router.post("/:deviceId/speaker/announce", controllers.announceDevice);
  router.post("/:deviceId/speaker/stop", controllers.stopDevice);
  router.post("/:deviceId/speaker/volume", controllers.setVolume);
  router.post("/:deviceId/speaker/mute", controllers.muteDevice);
  router.post("/:deviceId/speaker/unmute", controllers.unmuteDevice);
  router.post("/:deviceId/speaker/test-audio", controllers.testAudio);

  return router;
}
