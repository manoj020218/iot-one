import type { HomeAccessRole } from "@jenix/shared";
import type { Request, Response } from "express";

import {
  createScene,
  evaluateScheduledScenes,
  evaluateScenesByTelemetry,
  getScene,
  listSceneRunHistory,
  listScenes,
  patchScene,
  runSceneManually
} from "./scene.service";
import { SceneModuleError } from "./scene.types";
import {
  parseCreateScenePayload,
  parseManualRunPayload,
  parseScheduleRuntimePayload,
  parseScenePatchPayload,
  parseTelemetryRuntimePayload
} from "./scene.validation";
import type { SceneRequestContext } from "./scene.types";

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function parseHomeRole(value: string | undefined): HomeAccessRole | undefined {
  return value === "owner" ||
    value === "admin" ||
    value === "member" ||
    value === "viewer"
    ? value
    : undefined;
}

function readContext(request: Request): SceneRequestContext {
  const userId = readHeaderValue(request.header("x-user-id"));
  const homeId = readHeaderValue(request.header("x-home-id"));
  const homeRole = parseHomeRole(readHeaderValue(request.header("x-home-role")));

  return {
    ...(userId ? { userId } : {}),
    ...(homeId ? { homeId } : {}),
    ...(homeRole ? { homeRole } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof SceneModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal scene module error"
  });
}

export function listScenesController(request: Request, response: Response) {
  response.status(200).json({
    data: listScenes(readContext(request))
  });
}

export function getSceneController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: getScene(request.params.sceneId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function listSceneRunHistoryController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: listSceneRunHistory(request.params.sceneId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function createSceneController(request: Request, response: Response) {
  const payload = parseCreateScenePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid scene payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: createScene(payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function patchSceneController(request: Request, response: Response) {
  const payload = parseScenePatchPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid scene patch payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: patchScene(request.params.sceneId ?? "", payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function runSceneController(request: Request, response: Response) {
  const payload = parseManualRunPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid manual run payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: runSceneManually(request.params.sceneId ?? "", payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function evaluateTelemetryRuntimeController(
  request: Request,
  response: Response
) {
  const payload = parseTelemetryRuntimePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid telemetry runtime payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: evaluateScenesByTelemetry(payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export function evaluateScheduleRuntimeController(
  request: Request,
  response: Response
) {
  const payload = parseScheduleRuntimePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid schedule runtime payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: evaluateScheduledScenes(payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}
