import type { Request, Response } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { getQrunlockDevice, listQrunlockDevices } from "./device.service";
import { QrunlockDeviceError } from "./device.types";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof QrunlockDeviceError) {
    response.status(error.statusCode).json({
      error: { code: "QRUNLOCK_DEVICE_ERROR", message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal QRunlock module error", request_id: requestId }
  });
}

function requestContext(request: Request, deps: QrunlockPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createDeviceControllers(deps: QrunlockPlatformDeps) {
  return {
    async listDevices(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const devices = await listQrunlockDevices(deps, requestContext(request, deps));
        response.status(200).json({ data: devices });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async getDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const device = await getQrunlockDevice(
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
