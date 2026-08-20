import type { Request, Response } from "express";

import { readHomeIdFromRequest, requireAuthenticatedRequestUser } from "../../infrastructure/http/request-auth";

import { printCustom } from "./billing-dispenser.service";
import { BillingDispenserModuleError } from "./billing-dispenser.types";
import { parsePrintCustomRequest } from "./billing-dispenser.validation";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof BillingDispenserModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  response.status(500).json({ error: "Internal billing dispenser module error" });
}

export async function printCustomController(request: Request, response: Response) {
  const parsed = parsePrintCustomRequest(request.body);
  if (!parsed.ok) {
    response.status(400).json({ error: parsed.errors.join("; ") });
    return;
  }

  try {
    response.status(200).json({
      data: await printCustom(request.params.deviceId ?? "", parsed.data, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}
