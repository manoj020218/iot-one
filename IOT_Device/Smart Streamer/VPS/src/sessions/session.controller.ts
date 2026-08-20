import type { Request, Response } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import { forceStopSession, getSession, startSession, stopSession } from "./session.service";
import { StreamerSessionError } from "./session.types";
import { parseStartSessionInput, parseStopSessionInput } from "./session.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof StreamerSessionError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        request_id: requestId,
        ...(error.details ? { details: error.details } : {})
      }
    });
    return;
  }

  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal Smart Streamer module error", request_id: requestId }
  });
}

function requestContext(request: Request, deps: SmartStreamerPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

function requireHomeId(request: Request, deps: SmartStreamerPlatformDeps): string {
  const homeId = deps.readHomeIdFromRequest(request);
  if (!homeId) {
    throw new StreamerSessionError(400, "TENANT_MISMATCH", "x-home-id header is required");
  }
  return homeId;
}

export function createSessionControllers(deps: SmartStreamerPlatformDeps) {
  return {
    async start(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseStartSessionInput(request.body);
        if (!input) {
          throw new StreamerSessionError(422, "INVALID_REQUEST", "cameraId and destinationId are required");
        }
        const homeId = requireHomeId(request, deps);
        const result = await startSession(
          deps,
          request.params.deviceId ?? "",
          homeId,
          input,
          requestContext(request, deps)
        );
        response.status(202).json({ data: result });
      } catch (error) {
        sendError(
          response,
          error,
          requestId
        );
      }
    },

    async stop(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseStopSessionInput(request.body);
        if (!input) {
          throw new StreamerSessionError(422, "INVALID_REQUEST", "sessionId is required");
        }
        const homeId = requireHomeId(request, deps);
        const session = await stopSession(
          deps,
          request.params.deviceId ?? "",
          homeId,
          input,
          requestContext(request, deps)
        );
        response.status(200).json({ data: session });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async forceStop(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const sessionId = typeof request.body?.sessionId === "string" ? request.body.sessionId : "";
        if (!sessionId) {
          throw new StreamerSessionError(422, "INVALID_REQUEST", "sessionId is required");
        }
        const homeId = requireHomeId(request, deps);
        const session = await forceStopSession(
          deps,
          request.params.deviceId ?? "",
          homeId,
          sessionId,
          requestContext(request, deps)
        );
        response.status(200).json({ data: session });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async get(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = requireHomeId(request, deps);
        const session = await getSession(request.params.sessionId ?? "", homeId);
        response.set("Cache-Control", "no-store");
        response.set("Pragma", "no-cache");
        response.status(200).json({ data: session });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
