import type { Request, Response } from "express";

import type { UiPackageActorContext } from "./ui-package.types";
import { UiPackageModuleError } from "./ui-package.types";
import {
  addUiPackageVersion,
  deprecateUiPackageVersion,
  getUiPackage,
  listUiPackageAuditLog,
  listUiPackages,
  publishUiPackageVersion,
  registerUiPackage,
  rollbackUiPackage
} from "./ui-package.service";

const developerRoles = new Set(["JENIX_DEVELOPER", "JENIX_SUPER_ADMIN"]);

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function readActorContext(request: Request): UiPackageActorContext | null {
  const role = readHeaderValue(request.header("x-role"));
  const actorId = readHeaderValue(request.header("x-actor-id")) || "developer";

  if (!developerRoles.has(role)) {
    return null;
  }

  return {
    actorId,
    role: role as UiPackageActorContext["role"]
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof UiPackageModuleError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Internal UI package module error" });
}

function requireActor(request: Request, response: Response): UiPackageActorContext | null {
  const actor = readActorContext(request);

  if (!actor) {
    response.status(403).json({
      error: "UI package registry requires JENIX developer access"
    });
    return null;
  }

  return actor;
}

export async function listUiPackageController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({ data: await listUiPackages() });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getUiPackageController(request: Request, response: Response) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response.status(200).json({ data: await getUiPackage(request.params.packageId ?? "") });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getUiPackageAuditLogController(
  request: Request,
  response: Response
) {
  if (!requireActor(request, response)) {
    return;
  }

  try {
    response
      .status(200)
      .json({ data: await listUiPackageAuditLog(request.params.packageId ?? "") });
  } catch (error) {
    sendError(response, error);
  }
}

export async function registerUiPackageController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(201).json({ data: await registerUiPackage(request.body, actor) });
  } catch (error) {
    sendError(response, error);
  }
}

export async function addUiPackageVersionController(
  request: Request,
  response: Response
) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(201).json({
      data: await addUiPackageVersion(
        request.params.packageId ?? "",
        request.body,
        actor
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function publishUiPackageVersionController(
  request: Request,
  response: Response
) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(200).json({
      data: await publishUiPackageVersion(
        request.params.packageId ?? "",
        request.params.version ?? "",
        actor
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function deprecateUiPackageVersionController(
  request: Request,
  response: Response
) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  try {
    response.status(200).json({
      data: await deprecateUiPackageVersion(
        request.params.packageId ?? "",
        request.params.version ?? "",
        actor
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function rollbackUiPackageController(request: Request, response: Response) {
  const actor = requireActor(request, response);

  if (!actor) {
    return;
  }

  const targetVersion =
    typeof request.body?.version === "string" ? request.body.version.trim() : "";

  if (!targetVersion) {
    response.status(400).json({ error: "version is required" });
    return;
  }

  try {
    response.status(200).json({
      data: await rollbackUiPackage(request.params.packageId ?? "", targetVersion, actor)
    });
  } catch (error) {
    sendError(response, error);
  }
}
