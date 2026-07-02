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

export async function listPidController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({
      data: await listPids()
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getPidController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({
      data: await getPid(request.params.pid ?? "")
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function createPidController(request: Request, response: Response) {
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
      data: await createPid(parsed.data, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function updatePidController(request: Request, response: Response) {
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
      data: await updatePid(request.params.pid ?? "", parsed.data, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function approvePidController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(200).json({
      data: await approvePid(request.params.pid ?? "", actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function archivePidController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(200).json({
      data: await archivePid(request.params.pid ?? "", actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}
