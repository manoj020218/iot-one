import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";

import {
  factoryReset,
  listLogs,
  nextToken,
  playAnnouncement,
  previousToken,
  rebootDevice,
  resetToken,
  scrollText,
  setBrightness,
  setCounter,
  setToken,
  showText
} from "./p10-display.service";
import { P10DisplayModuleError } from "./p10-display.types";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof P10DisplayModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal P10 display module error" });
}

export async function setTokenController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await setToken(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function nextTokenController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await nextToken(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function previousTokenController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await previousToken(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function resetTokenController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await resetToken(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function setCounterController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await setCounter(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function showTextController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await showText(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function scrollTextController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await scrollText(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function setBrightnessController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await setBrightness(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function playAnnouncementController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await playAnnouncement(
        request.params.deviceId ?? "",
        request.body,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function rebootDeviceController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await rebootDevice(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function factoryResetController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await factoryReset(request.params.deviceId ?? "", readContext(request))
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
