import { Router, type Router as ExpressRouter } from "express";

import {
  getMatterDeviceStatusController,
  requestMatterBridgeSyncController,
  requestMatterCommissioningController
} from "./matter.controller";

export const matterRouter: ExpressRouter = Router();

matterRouter.get("/devices/:deviceId/status", getMatterDeviceStatusController);
matterRouter.post("/devices/:deviceId/commission", requestMatterCommissioningController);
matterRouter.post("/devices/:deviceId/bridge-sync", requestMatterBridgeSyncController);
