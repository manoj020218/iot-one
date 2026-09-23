import type { Request, Response } from "express";

import { DeviceModuleError } from "../devices/device.types";
import { issueOrGetDeviceCloudConfig } from "./device-enrollment.service";

function sendError(response: Response, error: unknown) {
  if (error instanceof DeviceModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal device enrollment error" });
}

export async function requestDeviceEnrollmentController(
  request: Request,
  response: Response
): Promise<void> {
  const deviceId = request.params.deviceId;

  if (!deviceId || !deviceId.trim()) {
    response.status(400).json({ error: "deviceId is required" });
    return;
  }

  try {
    const data = await issueOrGetDeviceCloudConfig(deviceId);
    response.status(200).json({ data });
  } catch (error) {
    sendError(response, error);
  }
}
