import type { Request, Response } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createSpeakerGroup, listSpeakerGroups, updateSpeakerGroup } from "./group.service";
import { SpeakerGroupError } from "./group.types";
import {
  parseCreateSpeakerGroupInput,
  parseUpdateSpeakerGroupInput
} from "./group.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof SpeakerGroupError) {
    response.status(error.statusCode).json({
      error: { code: "IP_SPEAKER_GROUP_ERROR", message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal IP Speaker group module error",
      request_id: requestId
    }
  });
}

function requestContext(request: Request, deps: IpSpeakerPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createSpeakerGroupControllers(deps: IpSpeakerPlatformDeps) {
  return {
    async listGroups(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_GROUP_ERROR",
              message: "homeId is required",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({ data: await listSpeakerGroups(homeId) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async createGroup(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseCreateSpeakerGroupInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_GROUP_ERROR",
              message: "Invalid speaker group payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(201).json({
          data: await createSpeakerGroup(deps, requestContext(request, deps), input)
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async updateGroup(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUpdateSpeakerGroupInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_GROUP_ERROR",
              message: "Invalid speaker group patch payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({
          data: await updateSpeakerGroup(
            deps,
            request.params.groupId ?? "",
            requestContext(request, deps),
            input
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
