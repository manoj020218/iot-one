import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";
import { getFactoryRecordProofOfPossession } from "../factory-records/factory-record.service";
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

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

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

export async function registerProvisioningIntentController(
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
    data: await registerProvisioningIntent(payload, readContext(request))
  });
}

export async function completeProvisioningController(
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
      data: await completeProvisioning(
        request.params.provisioningId ?? "",
        payload,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getProvisioningStatusController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await getProvisioningStatus(
        request.params.provisioningId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

/**
 * Lets the app skip asking the installer to type in a device's Security
 * Scheme 2 Proof-of-Possession -- the Flash Tool already captured it at
 * factory-flash time (real per-device secret, not guessable from the BLE
 * name), so an authenticated app session can just look it up by deviceId.
 * 404 covers both "never flashed with this feature" and "no factory record
 * for this device" -- the app treats both the same way, by falling back to
 * a manual entry field.
 */
export async function getFactoryRecordPopController(
  request: Request,
  response: Response
) {
  requireAuthenticatedRequestUser(request);

  const deviceId = request.params.deviceId ?? "";
  const proofOfPossession = await getFactoryRecordProofOfPossession(deviceId);

  if (!proofOfPossession) {
    response.status(404).json({ error: "No factory record for this device" });
    return;
  }

  response.status(200).json({ data: { proofOfPossession } });
}
