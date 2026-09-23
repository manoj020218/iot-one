import { Router, type Router as ExpressRouter } from "express";

import { requireDeviceIngestAuth } from "../../infrastructure/http/require-device-auth";
import { requestDeviceEnrollmentController } from "./device-enrollment.controller";

// Device-facing, mounted onto the shared /api/v1/devices base path
// (app.ts) alongside device.routes.ts's own /register and /telemetry --
// same requireDeviceIngestAuth (x-device-key) convention, no new auth
// scheme. Called by a device once it has Wi-Fi but no cloud/MQTT config
// yet; see IOT_Device/.../cloud_enrollment_service.cpp for the firmware
// side and the design note in NEW_PRODUCT_LAUNCH_SOP.md-adjacent HANDOFF
// entry for why this exists.
export const deviceEnrollmentRouter: ExpressRouter = Router();

deviceEnrollmentRouter.post(
  "/:deviceId/enrollment",
  requireDeviceIngestAuth,
  requestDeviceEnrollmentController
);
