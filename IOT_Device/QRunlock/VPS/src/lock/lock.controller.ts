import type { Request, Response } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { unlockDevice } from "./lock.service";
import { parseUnlockInput } from "./lock.validation";
import { QrunlockLockError } from "./lock.types";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof QrunlockLockError) {
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
    error: { code: "INTERNAL_ERROR", message: "Internal QRunlock module error", request_id: requestId }
  });
}

function requestContext(request: Request, deps: QrunlockPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createLockControllers(deps: QrunlockPlatformDeps) {
  return {
    async unlock(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUnlockInput(request.body);
        const result = await unlockDevice(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps),
          input,
          "app"
        );
        response.status(202).json({ data: result });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
