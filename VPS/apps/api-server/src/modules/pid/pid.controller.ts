import type { Request, Response } from "express";

import type { PidActorContext } from "./pid.types";
import { PidModuleError } from "./pid.types";
import {
  approvePid,
  archivePid,
  createPid,
  getPid,
  listPids,
  updatePid
} from "./pid.service";
import { parseCreatePidInput, parsePidPatchInput } from "./pid.validation";

const developerRoles = new Set(["JENIX_DEVELOPER", "JENIX_SUPER_ADMIN"]);

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function readActorContext(request: Request): PidActorContext | null {
  const role = readHeaderValue(request.header("x-role"));
  const actorId = readHeaderValue(request.header("x-actor-id")) || "developer";

  if (!developerRoles.has(role)) {
    return null;
  }

  return {
    actorId,
    role: role as PidActorContext["role"]
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof PidModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal PID module error"
  });
}

function requireActor(request: Request, response: Response): PidActorContext | null {
  const actor = readActorContext(request);

  if (!actor) {
    response.status(403).json({
      error: "PID management requires JENIX developer access"
    });
    return null;
  }

  return actor;
}

export function listPidController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  response.status(200).json({
    data: listPids()
  });
}

export function getPidController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({
      data: getPid(request.params.pid ?? "")
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function createPidController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  const parsed = parseCreatePidInput(request.body);

  if (!parsed.ok) {
    response.status(400).json({
      error: parsed.errors.join("; ")
    });
    return;
  }

  try {
    response.status(201).json({
      data: createPid(parsed.data, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function updatePidController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  const parsed = parsePidPatchInput(request.body);

  if (!parsed.ok) {
    response.status(400).json({
      error: parsed.errors.join("; ")
    });
    return;
  }

  try {
    response.status(200).json({
      data: updatePid(request.params.pid ?? "", parsed.data, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function approvePidController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(200).json({
      data: approvePid(request.params.pid ?? "", actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function archivePidController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(200).json({
      data: archivePid(request.params.pid ?? "", actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}
