import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";

import {
  deleteProfile,
  listLogs,
  listProfiles,
  rebootDevice,
  requestOta,
  runSequence,
  triggerProfile,
  updateConfig,
  upsertProfile
} from "./smart-rf-transmitter.service";
import { SmartRfTransmitterModuleError } from "./smart-rf-transmitter.types";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof SmartRfTransmitterModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal smart RF transmitter module error" });
}

export async function listProfilesController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listProfiles(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function upsertProfileController(request: Request, response: Response) {
  const profileId = Number(request.params.profileId);

  if (!Number.isInteger(profileId) || profileId <= 0) {
    response.status(400).json({ error: "profileId must be a positive integer" });
    return;
  }

  try {
    response.status(200).json({
      data: await upsertProfile(
        request.params.deviceId ?? "",
        profileId,
        request.body,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function deleteProfileController(request: Request, response: Response) {
  const profileId = Number(request.params.profileId);

  if (!Number.isInteger(profileId) || profileId <= 0) {
    response.status(400).json({ error: "profileId must be a positive integer" });
    return;
  }

  try {
    response.status(200).json({
      data: await deleteProfile(request.params.deviceId ?? "", profileId, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function triggerController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await triggerProfile(
        request.params.deviceId ?? "",
        request.body,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function sequenceController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await runSequence(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function updateConfigController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await updateConfig(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function otaController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await requestOta(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function rebootController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await rebootDevice(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listLogsController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listLogs(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}
