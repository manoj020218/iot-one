import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";

import {
  attendCall,
  dispatchCommand,
  listActiveCalls,
  listCallHistory,
  listRemotes,
  saveRemote
} from "./nurse-call-receiver.service";
import { NurseCallReceiverModuleError } from "./nurse-call-receiver.types";
import { parseNurseCallCommandPayload, parseSaveRemotePayload } from "./nurse-call-receiver.validation";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof NurseCallReceiverModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal nurse call receiver module error" });
}

export async function listRemotesController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listRemotes(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function saveRemoteController(request: Request, response: Response) {
  const parsed = parseSaveRemotePayload(request.body);

  if (!parsed.ok) {
    response.status(400).json({ error: parsed.errors.join("; ") });
    return;
  }

  try {
    response.status(201).json({
      data: await saveRemote(
        request.params.deviceId ?? "",
        parsed.data,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listActiveCallsController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listActiveCalls(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listCallHistoryController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listCallHistory(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function attendCallController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await attendCall(
        request.params.deviceId ?? "",
        request.params.callId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function dispatchNurseCallCommandController(
  request: Request,
  response: Response
) {
  const parsed = parseNurseCallCommandPayload(request.body);

  if (!parsed.ok) {
    response.status(400).json({ error: parsed.errors.join("; ") });
    return;
  }

  try {
    response.status(200).json({
      data: await dispatchCommand(
        request.params.deviceId ?? "",
        parsed.data.command,
        parsed.data.payload,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}
