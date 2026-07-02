import type { Request, Response } from "express";

import {
  createApiKey,
  createApiPackage,
  executePublicDeviceCommand,
  getApiPackage,
  getPublicDeviceState,
  listApiKeys,
  listApiPackages,
  revokeApiKey
} from "./api-access.service";
import type {
  ApiKeyRequestContext,
  ApiPackageActorContext
} from "./api-access.types";
import { ApiAccessModuleError } from "./api-access.types";
import {
  parseApiKeyPayload,
  parseApiPackagePayload,
  parsePublicCommandPayload
} from "./api-access.validation";

const developerRoles = new Set(["JENIX_DEVELOPER", "JENIX_SUPER_ADMIN"]);

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function parseHomeRole(value: string | undefined): ApiKeyRequestContext["homeRole"] {
  return value === "owner" ||
    value === "admin" ||
    value === "member" ||
    value === "viewer"
    ? value
    : undefined;
}

function readApiKeyContext(request: Request): ApiKeyRequestContext {
  const userId = readHeaderValue(request.header("x-user-id"));
  const homeId = readHeaderValue(request.header("x-home-id"));
  const homeRole = parseHomeRole(readHeaderValue(request.header("x-home-role")));

  return {
    ...(userId ? { userId } : {}),
    ...(homeId ? { homeId } : {}),
    ...(homeRole ? { homeRole } : {})
  };
}

function readActorContext(request: Request): ApiPackageActorContext | null {
  const role = readHeaderValue(request.header("x-role"));
  const actorId = readHeaderValue(request.header("x-actor-id")) ?? "developer";

  if (!role || !developerRoles.has(role)) {
    return null;
  }

  return {
    actorId,
    role: role as ApiPackageActorContext["role"]
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof ApiAccessModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal API access module error"
  });
}

function requireActor(
  request: Request,
  response: Response
): ApiPackageActorContext | null {
  const actor = readActorContext(request);

  if (!actor) {
    response.status(403).json({
      error: "API package management requires JENIX developer access"
    });
    return null;
  }

  return actor;
}

export function listApiPackagesController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  response.status(200).json({
    data: listApiPackages()
  });
}

export function getApiPackageController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({
      data: getApiPackage(request.params.packageId ?? "")
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function createApiPackageController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  const payload = parseApiPackagePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid API package payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: await createApiPackage(payload, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function listApiKeysController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: listApiKeys(readApiKeyContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function createApiKeyController(request: Request, response: Response) {
  const payload = parseApiKeyPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid API key payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: await createApiKey(payload, readApiKeyContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function revokeApiKeyController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: revokeApiKey(request.params.keyId ?? "", readApiKeyContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getPublicDeviceStateController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await getPublicDeviceState(
        request.params.deviceId ?? "",
        readHeaderValue(request.header("x-api-key")) ?? ""
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function executePublicDeviceCommandController(
  request: Request,
  response: Response
) {
  const payload = parsePublicCommandPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid public command payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await executePublicDeviceCommand(
        request.params.deviceId ?? "",
        readHeaderValue(request.header("x-api-key")) ?? "",
        payload
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}
