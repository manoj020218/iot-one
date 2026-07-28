import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";

import {
  benchTest,
  factoryReset,
  listLogs,
  rebootDevice,
  selectProfile,
  setSpeakerProfile,
  stopAlarm,
  testProfile,
  testSweep,
  testTone,
  triggerAlarm
} from "./sos-siren.service";
import { SosSirenModuleError } from "./sos-siren.types";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof SosSirenModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal SOS siren module error" });
}

export async function triggerAlarmController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await triggerAlarm(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function stopAlarmController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await stopAlarm(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function selectProfileController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await selectProfile(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function testProfileController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await testProfile(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function testToneController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await testTone(request.params.deviceId ?? "", request.body, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function testSweepController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await testSweep(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function benchTestController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await benchTest(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function setSpeakerProfileController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await setSpeakerProfile(
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
