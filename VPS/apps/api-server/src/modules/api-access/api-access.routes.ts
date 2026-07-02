import { Router, type Router as ExpressRouter } from "express";

import {
  createApiKeyController,
  createApiPackageController,
  executePublicDeviceCommandController,
  getApiPackageController,
  getPublicDeviceStateController,
  listApiKeysController,
  listApiPackagesController,
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

publicApiRouter.get("/devices/:deviceId/state", getPublicDeviceStateController);
publicApiRouter.post(
  "/devices/:deviceId/commands",
  executePublicDeviceCommandController
);
