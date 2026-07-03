import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";
import {
  getDevice,
  getDeviceFirmwarePlan,
  listDeviceFirmwareRollouts,
  ingestDeviceTelemetry,
  listDevices,
  patchDevice,
  replayDeviceFirmwareRollout,
  requestDeviceFirmwareUpdate,
  registerDevice,
  renameDevice
} from "./device.service";
import { DeviceModuleError } from "./device.types";
import {
  parseDevicePatchPayload,
  parseDeviceFirmwareRequestPayload,
  parseDeviceTelemetryPayload,
  parseRegisterDevicePayload,
  parseRenamePayload
} from "./device.validation";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof DeviceModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal device module error"
  });
}

export async function listDevicesController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listDevices(readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getDeviceController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await getDevice(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function registerDeviceController(request: Request, response: Response) {
  const payload = parseRegisterDevicePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid device registration payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: await registerDevice(payload)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function patchDeviceController(request: Request, response: Response) {
  const payload = parseDevicePatchPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid device patch payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await patchDevice(request.params.deviceId ?? "", payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getDeviceFirmwarePlanController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await getDeviceFirmwarePlan(
        request.params.deviceId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function renameDeviceController(request: Request, response: Response) {
  const payload = parseRenamePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid rename payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await renameDevice(
        request.params.deviceId ?? "",
        payload,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function requestDeviceFirmwareUpdateController(
  request: Request,
  response: Response
) {
  const payload = parseDeviceFirmwareRequestPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid firmware request payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await requestDeviceFirmwareUpdate(
        request.params.deviceId ?? "",
        payload,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listDeviceFirmwareRolloutsController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await listDeviceFirmwareRollouts(
        request.params.deviceId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function replayDeviceFirmwareRolloutController(
  request: Request,
  response: Response
) {
  try {
    response.status(201).json({
      data: await replayDeviceFirmwareRollout(
        request.params.deviceId ?? "",
        request.params.requestId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function ingestDeviceTelemetryController(
  request: Request,
  response: Response
) {
  const payload = parseDeviceTelemetryPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid telemetry payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await ingestDeviceTelemetry(request.params.deviceId ?? "", payload)
    });
  } catch (error) {
    sendError(response, error);
  }
}
