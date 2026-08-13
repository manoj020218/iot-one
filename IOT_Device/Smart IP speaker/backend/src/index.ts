import { Router, type Router as ExpressRouter } from "express";

import { createAnnouncementDeviceActionRouter, createAnnouncementTenantRouter } from "./announcements/announcement.routes";
import { createAudioAssetRouter } from "./audio-assets/audio-asset.routes";
import { IP_SPEAKER_INTERNAL_KEY, IP_SPEAKER_PERMISSIONS } from "./constants";
import { createSpeakerDeviceRouter } from "./devices/device.routes";
import { createSpeakerGroupRouter } from "./groups/group.routes";
import type { IpSpeakerPlatformDeps } from "./platform-deps";
import { createSpeakerScheduleRouter } from "./schedules/schedule.routes";

export type { IpSpeakerPlatformDeps } from "./platform-deps";

export { IP_SPEAKER_INTERNAL_KEY, IP_SPEAKER_PERMISSIONS } from "./constants";

export function createIpSpeakerRouter(deps: IpSpeakerPlatformDeps): ExpressRouter {
  const router = Router();

  router.use(createSpeakerDeviceRouter(deps));
  router.use(createAudioAssetRouter(deps));
  router.use(createSpeakerGroupRouter(deps));
  router.use(createAnnouncementTenantRouter(deps));
  router.use(createSpeakerScheduleRouter(deps));

  return router;
}

export function createIpSpeakerDeviceActionRouter(
  deps: IpSpeakerPlatformDeps
): ExpressRouter {
  const router = Router();

  router.use(createAnnouncementDeviceActionRouter(deps));

  return router;
}
