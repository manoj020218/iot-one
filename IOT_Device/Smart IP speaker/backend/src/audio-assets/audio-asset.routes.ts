import { Router, type Router as ExpressRouter } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createAudioAssetControllers } from "./audio-asset.controller";

export function createAudioAssetRouter(deps: IpSpeakerPlatformDeps): ExpressRouter {
  const router = Router();
  const controllers = createAudioAssetControllers(deps);

  router.get("/audio-assets", controllers.listAudioAssets);
  router.post("/audio-assets", controllers.createAudioAsset);
  router.patch("/audio-assets/:audioId", controllers.updateAudioAsset);

  return router;
}
