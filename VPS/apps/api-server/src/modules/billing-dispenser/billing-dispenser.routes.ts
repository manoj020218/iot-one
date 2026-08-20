import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import { printCustomController } from "./billing-dispenser.controller";

export const billingDispenserRouter: ExpressRouter = Router();

billingDispenserRouter.use(requireAuthenticatedUser);
billingDispenserRouter.post("/:deviceId/billing-dispenser/print-custom", printCustomController);
