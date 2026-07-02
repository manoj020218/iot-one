import type { HomeAccessRole } from "@jenix/shared";
import type { Request, Response } from "express";

import {
  getMatterDeviceStatus,
  requestMatterBridgeSync,
  requestMatterCommissioning
} from "./matter.service";
import { MatterModuleError } from "./matter.types";

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function parseHomeRole(value: string | undefined): HomeAccessRole | undefined {
  return value === "owner" ||
    value === "admin" ||
    value === "member" ||
    value === "viewer"
    ? value
    : undefined;
}

function readContext(request: Request) {
  const userId = readHeaderValue(request.header("x-user-id"));
  const homeId = readHeaderValue(request.header("x-home-id"));
  const homeRole = parseHomeRole(readHeaderValue(request.header("x-home-role")));

  return {
    ...(userId ? { userId } : {}),
    ...(homeId ? { homeId } : {}),
    ...(homeRole ? { homeRole } : {})
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
