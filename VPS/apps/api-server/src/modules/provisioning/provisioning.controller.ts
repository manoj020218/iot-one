import type { Request, Response } from "express";

import {
  completeProvisioning,
  getProvisioningStatus,
  registerProvisioningIntent
} from "./provisioning.service";
import { ProvisioningModuleError } from "./provisioning.types";
import {
  parseCompleteProvisioningPayload,
  parseRegisterProvisioningIntentPayload
} from "./provisioning.validation";

function sendError(response: Response, error: unknown) {
  if (error instanceof ProvisioningModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal provisioning module error"
  });
}

export function registerProvisioningIntentController(
  request: Request,
  response: Response
) {
  const payload = parseRegisterProvisioningIntentPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid provisioning intent payload"
    });
    return;
  }

  response.status(201).json({
    data: registerProvisioningIntent(payload)
  });
}

export function completeProvisioningController(
  request: Request,
  response: Response
) {
  const payload = parseCompleteProvisioningPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid provisioning completion payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: completeProvisioning(request.params.provisioningId ?? "", payload)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function getProvisioningStatusController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: getProvisioningStatus(request.params.provisioningId ?? "")
    });
  } catch (error) {
    sendError(response, error);
  }
}
