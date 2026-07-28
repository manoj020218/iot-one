import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import {
  benchTestController,
  factoryResetController,
  listLogsController,
  rebootDeviceController,
  selectProfileController,
  setSpeakerProfileController,
  stopAlarmController,
  testProfileController,
  testSweepController,
  testToneController,
  triggerAlarmController
} from "./sos-siren.controller";

export const sosSirenRouter: ExpressRouter = Router();

sosSirenRouter.use(requireAuthenticatedUser);
sosSirenRouter.post("/:deviceId/sos-siren/trigger", triggerAlarmController);
sosSirenRouter.post("/:deviceId/sos-siren/stop", stopAlarmController);
sosSirenRouter.post("/:deviceId/sos-siren/select-profile", selectProfileController);
sosSirenRouter.post("/:deviceId/sos-siren/test-profile", testProfileController);
sosSirenRouter.post("/:deviceId/sos-siren/test-tone", testToneController);
sosSirenRouter.post("/:deviceId/sos-siren/test-sweep", testSweepController);
sosSirenRouter.post("/:deviceId/sos-siren/bench-test", benchTestController);
sosSirenRouter.post("/:deviceId/sos-siren/speaker-profile", setSpeakerProfileController);
sosSirenRouter.post("/:deviceId/sos-siren/reboot", rebootDeviceController);
sosSirenRouter.post("/:deviceId/sos-siren/factory-reset", factoryResetController);
sosSirenRouter.get("/:deviceId/sos-siren/logs", listLogsController);
