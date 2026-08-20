import type { Request, Response } from "express";

import type { QrunlockPlatformDeps } from "../platform-deps";
import { addRfRemote, deleteRfRemote, listRfRemotes, renameRfRemote } from "./rf-remote.service";
import { QrunlockRfRemoteError } from "./rf-remote.types";
import { parseAddRfRemoteInput, parseRenameRfRemoteInput } from "./rf-remote.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof QrunlockRfRemoteError) {
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

export function createRfRemoteControllers(deps: QrunlockPlatformDeps) {
  return {
    async list(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const remotes = await listRfRemotes(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps)
        );
        response.status(200).json({ data: remotes });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async add(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseAddRfRemoteInput(request.body);
        const remote = await addRfRemote(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps),
          input.name
        );
        response.status(201).json({ data: remote });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async rename(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseRenameRfRemoteInput(request.body);
        if (!input) {
          throw new QrunlockRfRemoteError(422, "INVALID_REQUEST", "name is required");
        }
        const remote = await renameRfRemote(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps),
          request.params.remoteId ?? "",
          input.name
        );
        response.status(200).json({ data: remote });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async remove(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const result = await deleteRfRemote(
          deps,
          request.params.deviceId ?? "",
          requestContext(request, deps),
          request.params.remoteId ?? ""
        );
        response.status(200).json({ data: result });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
