import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import {
  factoryResetController,
  listLogsController,
  nextTokenController,
  playAnnouncementController,
  previousTokenController,
  rebootDeviceController,
  resetTokenController,
  scrollTextController,
  setBrightnessController,
  setCounterController,
  setTokenController,
  showTextController
} from "./p10-display.controller";

export const p10DisplayRouter: ExpressRouter = Router();

p10DisplayRouter.use(requireAuthenticatedUser);
p10DisplayRouter.post("/:deviceId/p10-display/set-token", setTokenController);
p10DisplayRouter.post("/:deviceId/p10-display/next-token", nextTokenController);
p10DisplayRouter.post("/:deviceId/p10-display/previous-token", previousTokenController);
p10DisplayRouter.post("/:deviceId/p10-display/reset-token", resetTokenController);
p10DisplayRouter.post("/:deviceId/p10-display/set-counter", setCounterController);
p10DisplayRouter.post("/:deviceId/p10-display/show-text", showTextController);
p10DisplayRouter.post("/:deviceId/p10-display/scroll-text", scrollTextController);
p10DisplayRouter.post("/:deviceId/p10-display/set-brightness", setBrightnessController);
p10DisplayRouter.post("/:deviceId/p10-display/play-announcement", playAnnouncementController);
p10DisplayRouter.post("/:deviceId/p10-display/reboot", rebootDeviceController);
p10DisplayRouter.post("/:deviceId/p10-display/factory-reset", factoryResetController);
p10DisplayRouter.get("/:deviceId/p10-display/logs", listLogsController);
