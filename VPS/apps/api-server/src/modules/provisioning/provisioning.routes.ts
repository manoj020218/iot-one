import { Router, type Router as ExpressRouter } from "express";

import {
  completeProvisioningController,
  getProvisioningStatusController,
  registerProvisioningIntentController
} from "./provisioning.controller";

export const provisioningRouter: ExpressRouter = Router();

provisioningRouter.post("/register-intent", registerProvisioningIntentController);
provisioningRouter.post("/:provisioningId/complete", completeProvisioningController);
provisioningRouter.get("/status/:provisioningId", getProvisioningStatusController);
