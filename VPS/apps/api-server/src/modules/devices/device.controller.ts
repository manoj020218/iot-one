import type { Request, Response } from "express";

import {
  getDevice,
  listDevices,
  patchDevice,
  registerDevice,
  renameDevice
} from "./device.service";
import { DeviceModuleError } from "./device.types";
import {
  parseDevicePatchPayload,
  parseRegisterDevicePayload,
  parseRenamePayload
} from "./device.validation";

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function readContext(request: Request) {
  const userId = readHeaderValue(request.header("x-user-id"));
  const homeId = readHeaderValue(request.header("x-home-id"));

  return {
    ...(userId ? { userId } : {}),
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

export function listDevicesController(request: Request, response: Response) {
  response.status(200).json({
    data: listDevices(readContext(request))
  });
}

export function getDeviceController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: getDevice(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function registerDeviceController(request: Request, response: Response) {
  const payload = parseRegisterDevicePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid device registration payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: registerDevice(payload)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function patchDeviceController(request: Request, response: Response) {
  const payload = parseDevicePatchPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid device patch payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: patchDevice(request.params.deviceId ?? "", payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function renameDeviceController(request: Request, response: Response) {
  const payload = parseRenamePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid rename payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: renameDevice(request.params.deviceId ?? "", payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}
