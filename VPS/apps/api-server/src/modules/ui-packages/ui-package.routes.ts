import { Router, type Router as ExpressRouter } from "express";

import {
  addUiPackageVersionController,
  deprecateUiPackageVersionController,
  getUiPackageAuditLogController,
  getUiPackageController,
  listUiPackageController,
  publishUiPackageVersionController,
  registerUiPackageController,
  rollbackUiPackageController
} from "./ui-package.controller";

export const uiPackageRouter: ExpressRouter = Router();

uiPackageRouter.get("/", listUiPackageController);
uiPackageRouter.post("/", registerUiPackageController);
uiPackageRouter.get("/:packageId", getUiPackageController);
uiPackageRouter.get("/:packageId/audit-log", getUiPackageAuditLogController);
uiPackageRouter.post("/:packageId/versions", addUiPackageVersionController);
uiPackageRouter.post(
  "/:packageId/versions/:version/publish",
  publishUiPackageVersionController
);
uiPackageRouter.post(
  "/:packageId/versions/:version/deprecate",
  deprecateUiPackageVersionController
);
uiPackageRouter.post("/:packageId/rollback", rollbackUiPackageController);
