import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";
import {
  createScene,
  evaluateScheduledScenes,
  evaluateScenesByTelemetry,
  getScene,
  listSceneDispatches,
  listSceneRunHistory,
  listScenes,
  patchScene,
  replaySceneDispatch,
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

function readContext(request: Request): SceneRequestContext {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
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

export async function listScenesController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listScenes(readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getSceneController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await getScene(request.params.sceneId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listSceneRunHistoryController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await listSceneRunHistory(request.params.sceneId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listSceneDispatchesController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await listSceneDispatches(request.params.sceneId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function createSceneController(request: Request, response: Response) {
  const payload = parseCreateScenePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid scene payload"
    });
    return;
  }

  try {
    response.status(201).json({
      data: await createScene(payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function patchSceneController(request: Request, response: Response) {
  const payload = parseScenePatchPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid scene patch payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await patchScene(request.params.sceneId ?? "", payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function runSceneController(request: Request, response: Response) {
  const payload = parseManualRunPayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid manual run payload"
    });
    return;
  }

  try {
    response.status(200).json({
      data: await runSceneManually(
        request.params.sceneId ?? "",
        payload,
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function replaySceneDispatchController(
  request: Request,
  response: Response
) {
  try {
    response.status(201).json({
      data: await replaySceneDispatch(
        request.params.sceneId ?? "",
        request.params.jobId ?? "",
        readContext(request)
      )
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function evaluateTelemetryRuntimeController(
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
      data: await evaluateScenesByTelemetry(payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function evaluateScheduleRuntimeController(
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
      data: await evaluateScheduledScenes(payload, readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}
