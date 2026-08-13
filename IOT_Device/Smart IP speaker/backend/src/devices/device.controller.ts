import type { Request, Response } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { getSpeakerDevice, listSpeakerDevices } from "./device.service";
import { SpeakerDeviceError } from "./device.types";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof SpeakerDeviceError) {
    response.status(error.statusCode).json({
      error: { code: "IP_SPEAKER_DEVICE_ERROR", message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal IP Speaker device module error",
      request_id: requestId
    }
  });
}

function requestContext(request: Request, deps: IpSpeakerPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createSpeakerDeviceControllers(deps: IpSpeakerPlatformDeps) {
  return {
    async listDevices(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(200).json({
          data: await listSpeakerDevices(deps, requestContext(request, deps))
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async getDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(200).json({
          data: await getSpeakerDevice(
            deps,
            request.params.deviceId ?? "",
            requestContext(request, deps)
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
