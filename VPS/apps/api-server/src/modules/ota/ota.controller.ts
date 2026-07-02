import type { Request, Response } from "express";

import {
  createOtaRelease,
  getOtaRelease,
  listOtaReleases
} from "./ota.service";
import type { OtaActorContext } from "./ota.types";
import { OtaModuleError } from "./ota.types";
import { parseOtaReleasePayload } from "./ota.validation";

const developerRoles = new Set(["JENIX_DEVELOPER", "JENIX_SUPER_ADMIN"]);

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function readActorContext(request: Request): OtaActorContext | null {
  const role = readHeaderValue(request.header("x-role"));
  const actorId = readHeaderValue(request.header("x-actor-id")) || "developer";

  if (!developerRoles.has(role)) {
    return null;
  }

  return {
    actorId,
    role: role as OtaActorContext["role"]
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof OtaModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal OTA module error"
  });
}

function requireActor(request: Request, response: Response): OtaActorContext | null {
  const actor = readActorContext(request);

  if (!actor) {
    response.status(403).json({
      error: "OTA management requires JENIX developer access"
    });
    return null;
  }

  return actor;
}

export async function listOtaReleasesController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({
      data: await listOtaReleases()
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getOtaReleaseController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({
      data: await getOtaRelease(request.params.releaseId ?? "")
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function createOtaReleaseController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  const payload = parseOtaReleasePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid OTA release payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: await createOtaRelease(payload, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}
