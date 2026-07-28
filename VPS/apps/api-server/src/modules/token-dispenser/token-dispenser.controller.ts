import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";

import {
  factoryReset,
  getTemplate,
  listLogs,
  printNext,
  resetRoll,
  saveTemplate,
  setCounter,
  setPrefix,
  testPrint
} from "./token-dispenser.service";
import { TokenDispenserModuleError } from "./token-dispenser.types";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof TokenDispenserModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal token dispenser module error" });
}

export async function printNextController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await printNext(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function testPrintController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await testPrint(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function resetRollController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await resetRoll(request.params.deviceId ?? "", readContext(request))
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

export async function setPrefixController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await setPrefix(request.params.deviceId ?? "", request.body, readContext(request))
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

export async function getTemplateController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await getTemplate(request.params.deviceId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function saveTemplateController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await saveTemplate(request.params.deviceId ?? "", request.body, readContext(request))
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
