import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";
import { requireDeviceIngestAuth } from "../../infrastructure/http/require-device-auth";

import {
  dispatchDeviceUiCommandController,
  getDeviceController,
  getDeviceFirmwarePlanController,
  getDeviceUiRuntimeController,
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

// Device-facing endpoints — authenticated by device credentials (x-device-key),
// NOT a user JWT. See SEC-02 fix / DEVICE_INTEGRATION_GUIDE.md.
deviceRouter.post("/register", requireDeviceIngestAuth, registerDeviceController);
deviceRouter.post(
  "/:deviceId/telemetry",
  requireDeviceIngestAuth,
  ingestDeviceTelemetryController
);

// Everything below requires an authenticated app user.
deviceRouter.use(requireAuthenticatedUser);
deviceRouter.get("/", listDevicesController);
deviceRouter.get("/:deviceId", getDeviceController);
deviceRouter.get("/:deviceId/ui-runtime", getDeviceUiRuntimeController);
deviceRouter.get("/:deviceId/firmware-plan", getDeviceFirmwarePlanController);
deviceRouter.get("/:deviceId/firmware/rollouts", listDeviceFirmwareRolloutsController);
deviceRouter.post(
  "/:deviceId/firmware/rollouts/:requestId/replay",
  replayDeviceFirmwareRolloutController
);
deviceRouter.post("/:deviceId/commands", dispatchDeviceUiCommandController);
deviceRouter.patch("/:deviceId", patchDeviceController);
deviceRouter.post("/:deviceId/firmware/request", requestDeviceFirmwareUpdateController);
deviceRouter.post("/:deviceId/rename", renameDeviceController);
