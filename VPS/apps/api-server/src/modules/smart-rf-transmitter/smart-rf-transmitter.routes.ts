import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import {
  deleteProfileController,
  listLogsController,
  listProfilesController,
  otaController,
  rebootController,
  sequenceController,
  triggerController,
  updateConfigController,
  upsertProfileController
} from "./smart-rf-transmitter.controller";

export const smartRfTransmitterRouter: ExpressRouter = Router();

smartRfTransmitterRouter.use(requireAuthenticatedUser);
smartRfTransmitterRouter.get(
  "/:deviceId/smart-rf-transmitter/profiles",
  listProfilesController
);
smartRfTransmitterRouter.put(
  "/:deviceId/smart-rf-transmitter/profiles/:profileId",
  upsertProfileController
);
smartRfTransmitterRouter.delete(
  "/:deviceId/smart-rf-transmitter/profiles/:profileId",
  deleteProfileController
);
smartRfTransmitterRouter.post("/:deviceId/smart-rf-transmitter/trigger", triggerController);
smartRfTransmitterRouter.post("/:deviceId/smart-rf-transmitter/sequence", sequenceController);
smartRfTransmitterRouter.put("/:deviceId/smart-rf-transmitter/config", updateConfigController);
smartRfTransmitterRouter.post("/:deviceId/smart-rf-transmitter/ota", otaController);
smartRfTransmitterRouter.post("/:deviceId/smart-rf-transmitter/reboot", rebootController);
smartRfTransmitterRouter.get("/:deviceId/smart-rf-transmitter/logs", listLogsController);
