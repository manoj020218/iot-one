import type { Request, Response } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { listActivity } from "./activity.service";
import { QrunlockActivityError } from "./activity.types";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof QrunlockActivityError) {
    response.status(error.statusCode).json({
      error: { code: "QRUNLOCK_ACTIVITY_ERROR", message: error.message, request_id: requestId }
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

export function createActivityControllers(deps: QrunlockPlatformDeps) {
  return {
    async list(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const events = await listActivity(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.set("Cache-Control", "no-store");
        response.status(200).json({ data: events });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
