import {
  IP_SPEAKER_INTERNAL_KEY,
  createIpSpeakerDeviceActionRouter,
  createIpSpeakerRouter
} from "@jenix/ip-speaker-backend";
import {
  QRUNLOCK_PID,
  applyRfLearnResult as applyQrunlockRfLearnResult,
  createQrunlockDeviceActionRouter,
  createQrunlockRouter,
  getSettings as getQrunlockSettings,
  listActivity as listQrunlockActivity,
  unlockDevice as unlockQrunlockDevice,
  updateSettings as updateQrunlockSettings,
  type UpdateSettingsInput as QrunlockUpdateSettingsInput
} from "@jenix/qrunlock-backend";
import {
  createSmartStreamerDeviceActionRouter,
  createSmartStreamerRouter
} from "@jenix/smart-streamer-backend";
import express, { type Express } from "express";

import { requireAuthenticatedUser } from "./infrastructure/http/request-auth";
import { requireAdminApiKey } from "./infrastructure/http/require-admin";
import {
  adminApiPackageRouter,
  apiKeyRouter,
  publicApiRouter
} from "./modules/api-access/api-access.routes";
import { registerPublicDeviceCapabilities } from "./modules/api-access/public-device-capabilities";
import { registerDeviceEventHandler } from "./infrastructure/mqtt/device-event-capabilities";
import { authRouter } from "./modules/auth/auth.routes";
import { billingDispenserRouter } from "./modules/billing-dispenser/billing-dispenser.routes";
import { deviceRouter } from "./modules/devices/device.routes";
import { healthRouter } from "./modules/health/health.routes";
import { homeRouter } from "./modules/homes/home.routes";
import { matterRouter } from "./modules/matter/matter.routes";
import { notificationRouter } from "./modules/notifications/notification.routes";
import { nurseCallReceiverRouter } from "./modules/nurse-call-receiver/nurse-call-receiver.routes";
import { p10DisplayRouter } from "./modules/p10-display/p10-display.routes";
import { smartRfTransmitterRouter } from "./modules/smart-rf-transmitter/smart-rf-transmitter.routes";
import { sosSirenRouter } from "./modules/sos-siren/sos-siren.routes";
import { tokenDispenserRouter } from "./modules/token-dispenser/token-dispenser.routes";
import { publicPidRouter } from "./modules/pid/pid.public.routes";
import { pidRouter } from "./modules/pid/pid.routes";
import * as platformApi from "./platform-api";
import { provisioningRouter } from "./modules/provisioning/provisioning.routes";
import { sceneRouter } from "./modules/scenes/scene.routes";
import { otaRouter } from "./modules/ota/ota.routes";
import { uiPackageRouter } from "./modules/ui-packages/ui-package.routes";

/**
 * The hosted PWA (one.jenix.in) calls this API same-origin (nginx proxies
 * /api/ -> this server), so no CORS was ever needed. The Capacitor app is
 * served from https://localhost/ instead, which has no backend of its own
 * (see PWA_APK/apps/web-pwa's apiOrigin.ts) -- its calls to this API are
 * genuinely cross-origin and get rejected by the browser's CORS check
 * without this. A small fixed allowlist rather than the `cors` package:
 * the set of origins is tiny and won't grow often, and it avoids a new
 * dependency for something this narrow.
 */
const CORS_ALLOWED_ORIGINS = new Set([
  "https://localhost", // Capacitor Android (and iOS, same origin scheme)
  "capacitor://localhost" // iOS Capacitor's WKWebView custom scheme
]);

function applyCors(app: Express) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && CORS_ALLOWED_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Home-Id, X-Jenix-Local-Token"
      );
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  applyCors(app);
  app.use(express.json());
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/homes", requireAuthenticatedUser, homeRouter);
  app.use("/api/v1/api-keys", requireAuthenticatedUser, apiKeyRouter);
  app.use("/api/v1/devices", deviceRouter);
  app.use("/api/v1/devices", nurseCallReceiverRouter);
  app.use("/api/v1/devices", smartRfTransmitterRouter);
  app.use("/api/v1/devices", tokenDispenserRouter);
  app.use("/api/v1/devices", billingDispenserRouter);
  app.use("/api/v1/devices", p10DisplayRouter);
  app.use("/api/v1/devices", sosSirenRouter);
  // ===== PLUGIN MOUNT POINTS — device plugin developers =====
  // Add your product's device-action router mount line(s) inside this
  // block only, following the existing examples exactly. Do not add
  // app.use() calls anywhere else in this file. See
  // DEVICE_DEVELOPER_BOUNDARIES.md §3 — propose this as a diff for the
  // platform lead to apply, do not merge it yourself.
  app.use(
    "/api/v1/devices",
    requireAuthenticatedUser,
    createSmartStreamerDeviceActionRouter(platformApi)
  );
  app.use(
    "/api/v1/devices",
    requireAuthenticatedUser,
    createIpSpeakerDeviceActionRouter(platformApi)
  );
  app.use(
    "/api/v1/devices",
    requireAuthenticatedUser,
    createQrunlockDeviceActionRouter(platformApi)
  );
  // ===== END PLUGIN MOUNT POINTS (device-action routers) =====
  app.use("/api/v1/matter", requireAuthenticatedUser, matterRouter);
  app.use("/api/v1/notifications", requireAuthenticatedUser, notificationRouter);
  app.use("/api/v1/public", publicApiRouter);
  app.use("/api/v1/pids", publicPidRouter);
  // SEC-01 — admin surface is gated by a shared secret (x-admin-key) on top of
  // the x-role developer check the controllers already perform.
  app.use("/api/v1/admin/api-packages", requireAdminApiKey, adminApiPackageRouter);
  app.use("/api/v1/admin/ota", requireAdminApiKey, otaRouter);
  app.use("/api/v1/admin/pids", requireAdminApiKey, pidRouter);
  app.use("/api/v1/admin/ui-packages", requireAdminApiKey, uiPackageRouter);
  app.use("/api/v1/provisioning", requireAuthenticatedUser, provisioningRouter);
  app.use("/api/v1/scenes", requireAuthenticatedUser, sceneRouter);
  // ===== PLUGIN MOUNT POINTS — device plugin developers =====
  // Add your product's tenant-scoped router mount line(s) inside this
  // block only. See DEVICE_DEVELOPER_BOUNDARIES.md §3.
  app.use(
    "/api/v1/streamer",
    requireAuthenticatedUser,
    createSmartStreamerRouter(platformApi)
  );
  app.use(
    `/api/v1/${IP_SPEAKER_INTERNAL_KEY}`,
    requireAuthenticatedUser,
    createIpSpeakerRouter(platformApi)
  );
  app.use(
    "/api/v1/qrunlock",
    requireAuthenticatedUser,
    createQrunlockRouter(platformApi)
  );
  // ===== END PLUGIN MOUNT POINTS (tenant-scoped routers) =====
  app.use("/api/v1", healthRouter);

  // Vendor/public-API capabilities — lets a specific PID's own guarded
  // service functions handle a vendor-triggered command/config/logs call
  // instead of the generic scene-command dispatch. See
  // modules/api-access/public-device-capabilities.ts and
  // IOT_Device/QRunlock/RELAY_INTEGRATION_PLAN.md. `caller` is always
  // supplied by executePublicDeviceCommand itself (never client input).
  registerPublicDeviceCapabilities(QRUNLOCK_PID, {
    async executeCommand(deviceId, homeId, command, payload, caller) {
      if (command !== "unlock") {
        // QRunlock is a RIM-lock PSU — inching/unlock only, deliberately
        // no on/off/toggle (see ProductIdentity.h's kProductLine and
        // lock/lock.service.ts's doc comment). Reject clearly rather than
        // silently accepting a command the hardware doesn't support.
        throw Object.assign(new Error(`QRunlock does not support command: ${command}`), {
          statusCode: 400,
          code: "UNSUPPORTED_COMMAND"
        });
      }

      const reason = typeof payload.reason === "string" ? payload.reason : undefined;
      const result = await unlockQrunlockDevice(
        platformApi,
        deviceId,
        { homeId },
        { ...(reason ? { reason } : {}) },
        caller
      );

      return { ...result };
    },
    async getConfig(deviceId, homeId) {
      return getQrunlockSettings(platformApi, deviceId, { homeId });
    },
    async patchConfig(deviceId, homeId, patch) {
      return updateQrunlockSettings(
        platformApi,
        deviceId,
        { homeId },
        patch as QrunlockUpdateSettingsInput
      );
    },
    async getLogs(deviceId, homeId, limit) {
      const events = await listQrunlockActivity(platformApi, deviceId, { homeId });
      return events.slice(0, limit);
    }
  });

  // Device-originated .../events MQTT messages (see
  // infrastructure/mqtt/device-event-capabilities.ts and
  // CloudBridgeService::PublishRfLearnResult on the firmware side) — the
  // only way the platform learns an RF-learn attempt actually succeeded or
  // timed out, since that resolves later and asynchronously from whenever
  // the command was sent.
  registerDeviceEventHandler(QRUNLOCK_PID, async (deviceId, payload) => {
    const eventType = typeof payload.eventType === "string" ? payload.eventType : undefined;
    if (eventType === "rf_learned") {
      await applyQrunlockRfLearnResult(deviceId, "learned");
    } else if (eventType === "rf_learn_timeout") {
      await applyQrunlockRfLearnResult(deviceId, "timeout");
    }
  });

  return app;
}
