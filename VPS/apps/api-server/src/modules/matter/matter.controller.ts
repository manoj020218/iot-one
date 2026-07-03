import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";
import {
  getMatterDeviceStatus,
  requestMatterBridgeSync,
  requestMatterCommissioning
} from "./matter.service";
import { MatterModuleError } from "./matter.types";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof MatterModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal Matter module error"
  });
}

export async function getMatterDeviceStatusController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await getMatterDeviceStatus(
        request.params.deviceId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function requestMatterCommissioningController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await requestMatterCommissioning(
        request.params.deviceId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function requestMatterBridgeSyncController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await requestMatterBridgeSync(
        request.params.deviceId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}
