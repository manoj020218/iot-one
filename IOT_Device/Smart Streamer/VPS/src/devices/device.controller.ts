import type { Request, Response } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { getStreamerDevice, listStreamerDevices } from "./device.service";
import { StreamerDeviceError } from "./device.types";

/**
 * Error envelope is { error: { code, message, request_id } }, not the rest
 * of the platform's flat { error: "message" } (see pid.controller.ts) —
 * deliberate: VPS/API_CONTRACT.md §10 lists stable codes
 * (DEVICE_ALREADY_STREAMING etc.) the PWA switches on, not just displays.
 * Worth the rest of the platform adopting eventually; not done here.
 */
function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof StreamerDeviceError) {
    response.status(error.statusCode).json({
      error: { code: "STREAMER_DEVICE_ERROR", message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal Smart Streamer module error", request_id: requestId }
  });
}

function requestContext(request: Request, deps: SmartStreamerPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createDeviceControllers(deps: SmartStreamerPlatformDeps) {
  return {
    async listDevices(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const devices = await listStreamerDevices(deps, requestContext(request, deps));
        response.status(200).json({ data: devices });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async getDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const device = await getStreamerDevice(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.status(200).json({ data: device });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
