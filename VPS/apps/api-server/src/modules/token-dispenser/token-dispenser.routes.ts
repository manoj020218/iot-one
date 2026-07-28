import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import {
  factoryResetController,
  getTemplateController,
  listLogsController,
  printNextController,
  resetRollController,
  saveTemplateController,
  setCounterController,
  setPrefixController,
  testPrintController
} from "./token-dispenser.controller";

export const tokenDispenserRouter: ExpressRouter = Router();

tokenDispenserRouter.use(requireAuthenticatedUser);
tokenDispenserRouter.post("/:deviceId/token-dispenser/print-next", printNextController);
tokenDispenserRouter.post("/:deviceId/token-dispenser/test-print", testPrintController);
tokenDispenserRouter.post("/:deviceId/token-dispenser/reset-roll", resetRollController);
tokenDispenserRouter.post("/:deviceId/token-dispenser/set-counter", setCounterController);
tokenDispenserRouter.post("/:deviceId/token-dispenser/set-prefix", setPrefixController);
tokenDispenserRouter.post("/:deviceId/token-dispenser/factory-reset", factoryResetController);
tokenDispenserRouter.get("/:deviceId/token-dispenser/template", getTemplateController);
tokenDispenserRouter.put("/:deviceId/token-dispenser/template", saveTemplateController);
tokenDispenserRouter.get("/:deviceId/token-dispenser/logs", listLogsController);
