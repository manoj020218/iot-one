import express, { type Express } from "express";

import {
  adminApiPackageRouter,
  apiKeyRouter,
  publicApiRouter
} from "./modules/api-access/api-access.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { deviceRouter } from "./modules/devices/device.routes";
import { healthRouter } from "./modules/health/health.routes";
import { homeRouter } from "./modules/homes/home.routes";
import { publicPidRouter } from "./modules/pid/pid.public.routes";
import { pidRouter } from "./modules/pid/pid.routes";
import { provisioningRouter } from "./modules/provisioning/provisioning.routes";
import { sceneRouter } from "./modules/scenes/scene.routes";
import { otaRouter } from "./modules/ota/ota.routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/homes", homeRouter);
  app.use("/api/v1/api-keys", apiKeyRouter);
  app.use("/api/v1/devices", deviceRouter);
  app.use("/api/v1/public", publicApiRouter);
  app.use("/api/v1/pids", publicPidRouter);
  app.use("/api/v1/admin/api-packages", adminApiPackageRouter);
  app.use("/api/v1/admin/ota", otaRouter);
  app.use("/api/v1/admin/pids", pidRouter);
  app.use("/api/v1/provisioning", provisioningRouter);
  app.use("/api/v1/scenes", sceneRouter);
  app.use("/api/v1", healthRouter);

  return app;
}
