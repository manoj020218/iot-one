import type { Request, Response } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { getSettings, updateSettings } from "./settings.service";
import { QrunlockSettingsError } from "./settings.types";
import { parseUpdateSettingsInput } from "./settings.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof QrunlockSettingsError) {
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

export function createSettingsControllers(deps: QrunlockPlatformDeps) {
  return {
    async get(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const settings = await getSettings(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.status(200).json({ data: settings });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async update(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUpdateSettingsInput(request.body);
        if (!input) {
          throw new QrunlockSettingsError(
            422,
            "INVALID_REQUEST",
            "at least one of relayCooldownMs (0-10000), relayStateAfterPowerRestore, switchType is required, and any field provided must be valid"
          );
        }
        const settings = await updateSettings(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps),
          input
        );
        response.status(200).json({ data: settings });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
