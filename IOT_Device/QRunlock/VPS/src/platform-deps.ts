import type { NextFunction, Request, Response } from "express";
import type {
  DeviceRecord,
  DeviceUiCommandAckRecord,
  DeviceUiCommandRequest,
  HomeAccessRole
} from "@jenix/shared";

/**
 * This is the ONLY contract this package has with the rest of the
 * platform. Every field here is structurally identical to the real
 * function it stands in for in api-server (device.service.ts,
 * request-auth.ts) — api-server passes its actual functions in, this
 * package never imports api-server's files directly. See README.md for
 * why, and IOT_Device/Smart Streamer/VPS/src/platform-deps.ts for the
 * original version of this pattern.
 *
 * Deliberately smaller than SmartStreamerPlatformDeps: QRunlock has no
 * scene/scheduling needs of its own today (its scene participation is the
 * generic set_relay/refresh commands every device already gets — see
 * DEVICE_INTEGRATION_GUIDE.md — not a QRunlock-specific scheduling
 * concept the way Smart Streamer's start/stop windows are). Only declare
 * what you actually call.
 */

export interface DeviceRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface QrunlockPlatformDeps {
  // Auth — from infrastructure/http/request-auth.ts
  requireAuthenticatedUser: (request: Request, response: Response, next: NextFunction) => void;
  requireAuthenticatedRequestUser: (request: Request) => { userId: string };
  readHomeIdFromRequest: (request: Request) => string | undefined;

  // Device registry — from modules/devices/device.service.ts
  listDevices: (context: DeviceRequestContext) => Promise<DeviceRecord[]>;
  getDevice: (deviceId: string, context: DeviceRequestContext) => Promise<DeviceRecord>;
  dispatchDeviceUiCommand: (
    deviceId: string,
    payload: DeviceUiCommandRequest,
    context: DeviceRequestContext
  ) => Promise<DeviceUiCommandAckRecord>;
}
