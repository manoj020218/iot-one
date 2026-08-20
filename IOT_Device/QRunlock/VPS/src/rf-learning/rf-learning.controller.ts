import type { Request, Response } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { cancelRfLearning, getRfLearnState, startRfLearning } from "./rf-learning.service";
import { QrunlockRfLearnError } from "./rf-learning.types";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof QrunlockRfLearnError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal QRunlock module error", request_id: requestId }
  });
}

function requestContext(request: Request, deps: QrunlockPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createRfLearningControllers(deps: QrunlockPlatformDeps) {
  return {
    async start(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const state = await startRfLearning(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.status(202).json({ data: state });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async cancel(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const state = await cancelRfLearning(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.status(200).json({ data: state });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async status(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const state = await getRfLearnState(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.set("Cache-Control", "no-store");
        response.status(200).json({ data: state });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
