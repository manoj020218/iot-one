import { Router, type Router as ExpressRouter } from "express";

import {
  createApiKeyController,
  createApiPackageController,
  executePublicDeviceCommandController,
  getApiPackageController,
  getPublicDeviceStateController,
  getVendorDeviceConfigController,
  getVendorDeviceLogsController,
  listApiKeysController,
  listApiPackagesController,
  listVendorDevicesController,
  patchVendorDeviceConfigController,
  registerVendorDeviceController,
  revokeApiKeyController
} from "./api-access.controller";

export const adminApiPackageRouter: ExpressRouter = Router();
export const apiKeyRouter: ExpressRouter = Router();
export const publicApiRouter: ExpressRouter = Router();

adminApiPackageRouter.get("/", listApiPackagesController);
adminApiPackageRouter.post("/", createApiPackageController);
adminApiPackageRouter.get("/:packageId", getApiPackageController);

apiKeyRouter.get("/", listApiKeysController);
apiKeyRouter.post("/", createApiKeyController);
apiKeyRouter.post("/:keyId/revoke", revokeApiKeyController);

// Vendor-authenticated (x-api-key, no Jenix user session) — see
// IOT_Device/QRunlock/RELAY_INTEGRATION_PLAN.md for why these exist:
// a QRunlock host never logs into Jenix One, so device claim/list/config/
// logs need an API-key-only path, scoped to the key's own HOME (the
// "vendor pool HOME").
publicApiRouter.post("/devices/register", registerVendorDeviceController);
publicApiRouter.get("/devices", listVendorDevicesController);
publicApiRouter.get("/devices/:deviceId/state", getPublicDeviceStateController);
publicApiRouter.post(
  "/devices/:deviceId/commands",
  executePublicDeviceCommandController
);
publicApiRouter.get("/devices/:deviceId/config", getVendorDeviceConfigController);
publicApiRouter.patch("/devices/:deviceId/config", patchVendorDeviceConfigController);
publicApiRouter.get("/devices/:deviceId/logs", getVendorDeviceLogsController);
