import { Router, type Router as ExpressRouter } from "express";

import {
  getDeviceController,
  ingestDeviceTelemetryController,
  listDevicesController,
  patchDeviceController,
  requestDeviceFirmwareUpdateController,
  registerDeviceController,
  renameDeviceController
} from "./device.controller";

export const deviceRouter: ExpressRouter = Router();

deviceRouter.get("/", listDevicesController);
deviceRouter.post("/register", registerDeviceController);
deviceRouter.get("/:deviceId", getDeviceController);
deviceRouter.patch("/:deviceId", patchDeviceController);
deviceRouter.post("/:deviceId/firmware/request", requestDeviceFirmwareUpdateController);
deviceRouter.post("/:deviceId/telemetry", ingestDeviceTelemetryController);
deviceRouter.post("/:deviceId/rename", renameDeviceController);
