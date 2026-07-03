import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import {
  getDeviceController,
  getDeviceFirmwarePlanController,
  listDeviceFirmwareRolloutsController,
  ingestDeviceTelemetryController,
  listDevicesController,
  patchDeviceController,
  replayDeviceFirmwareRolloutController,
  requestDeviceFirmwareUpdateController,
  registerDeviceController,
  renameDeviceController
} from "./device.controller";

export const deviceRouter: ExpressRouter = Router();

deviceRouter.post("/register", registerDeviceController);
deviceRouter.post("/:deviceId/telemetry", ingestDeviceTelemetryController);
deviceRouter.use(requireAuthenticatedUser);
deviceRouter.get("/", listDevicesController);
deviceRouter.get("/:deviceId", getDeviceController);
deviceRouter.get("/:deviceId/firmware-plan", getDeviceFirmwarePlanController);
deviceRouter.get("/:deviceId/firmware/rollouts", listDeviceFirmwareRolloutsController);
deviceRouter.post(
  "/:deviceId/firmware/rollouts/:requestId/replay",
  replayDeviceFirmwareRolloutController
);
deviceRouter.patch("/:deviceId", patchDeviceController);
deviceRouter.post("/:deviceId/firmware/request", requestDeviceFirmwareUpdateController);
deviceRouter.post("/:deviceId/rename", renameDeviceController);
