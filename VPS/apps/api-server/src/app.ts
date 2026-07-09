import express, { type Express } from "express";

import { requireAuthenticatedUser } from "./infrastructure/http/request-auth";
import { requireAdminApiKey } from "./infrastructure/http/require-admin";
import {
  adminApiPackageRouter,
  apiKeyRouter,
  publicApiRouter
} from "./modules/api-access/api-access.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { deviceRouter } from "./modules/devices/device.routes";
import { healthRouter } from "./modules/health/health.routes";
import { homeRouter } from "./modules/homes/home.routes";
import { matterRouter } from "./modules/matter/matter.routes";
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
  app.use("/api/v1/homes", requireAuthenticatedUser, homeRouter);
  app.use("/api/v1/api-keys", requireAuthenticatedUser, apiKeyRouter);
  app.use("/api/v1/devices", deviceRouter);
  app.use("/api/v1/matter", requireAuthenticatedUser, matterRouter);
  app.use("/api/v1/public", publicApiRouter);
  app.use("/api/v1/pids", publicPidRouter);
  // SEC-01 — admin surface is gated by a shared secret (x-admin-key) on top of
  // the x-role developer check the controllers already perform.
  app.use("/api/v1/admin/api-packages", requireAdminApiKey, adminApiPackageRouter);
  app.use("/api/v1/admin/ota", requireAdminApiKey, otaRouter);
  app.use("/api/v1/admin/pids", requireAdminApiKey, pidRouter);
  app.use("/api/v1/provisioning", requireAuthenticatedUser, provisioningRouter);
  app.use("/api/v1/scenes", requireAuthenticatedUser, sceneRouter);
  app.use("/api/v1", healthRouter);

  return app;
}
