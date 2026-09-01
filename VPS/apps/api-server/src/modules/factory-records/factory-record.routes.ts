import { Router, type Router as ExpressRouter } from "express";

import { saveFactoryRecordController } from "./factory-record.controller";

// Mounted at /api/v1/admin/factory-records behind requireAdminApiKey (app.ts)
// -- called only by the Flash Tool right after a factory flash, never by the
// app. The read side installers actually use lives in the provisioning
// module instead, behind normal user-session auth.
export const factoryRecordAdminRouter: ExpressRouter = Router();

factoryRecordAdminRouter.post("/", saveFactoryRecordController);
