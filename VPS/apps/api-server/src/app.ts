import express, { type Express } from "express";

import { authRouter } from "./modules/auth/auth.routes";
import { deviceRouter } from "./modules/devices/device.routes";
import { healthRouter } from "./modules/health/health.routes";
import { homeRouter } from "./modules/homes/home.routes";
import { pidRouter } from "./modules/pid/pid.routes";
import { provisioningRouter } from "./modules/provisioning/provisioning.routes";
import { sceneRouter } from "./modules/scenes/scene.routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/homes", homeRouter);
  app.use("/api/v1/devices", deviceRouter);
  app.use("/api/v1/admin/pids", pidRouter);
  app.use("/api/v1/provisioning", provisioningRouter);
  app.use("/api/v1/scenes", sceneRouter);
  app.use("/api/v1", healthRouter);

  return app;
}
