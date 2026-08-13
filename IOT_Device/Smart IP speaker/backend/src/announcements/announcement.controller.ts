import type { Request, Response } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import {
  announceToTarget,
  listRecentAnnouncements,
  setDeviceMute,
  setDeviceVolume,
  stopDeviceAnnouncement,
  testDeviceTone
} from "./announcement.service";
import { SpeakerAnnouncementError } from "./announcement.types";
import {
  parseSendAnnouncementInput,
  parseSetSpeakerVolumeInput
} from "./announcement.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof SpeakerAnnouncementError) {
    response.status(error.statusCode).json({
      error: {
        code: "IP_SPEAKER_ANNOUNCEMENT_ERROR",
        message: error.message,
        request_id: requestId
      }
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal IP Speaker announcement module error",
      request_id: requestId
    }
  });
}

function requestContext(request: Request, deps: IpSpeakerPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createAnnouncementControllers(deps: IpSpeakerPlatformDeps) {
  return {
    async listRecent(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_ANNOUNCEMENT_ERROR",
              message: "homeId is required",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({ data: await listRecentAnnouncements(homeId) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async announceDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseSendAnnouncementInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_ANNOUNCEMENT_ERROR",
              message: "Invalid device announcement payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(202).json({
          data: await announceToTarget(
            deps,
            "device",
            request.params.deviceId ?? "",
            requestContext(request, deps),
            input
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async announceGroup(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseSendAnnouncementInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_ANNOUNCEMENT_ERROR",
              message: "Invalid group announcement payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(202).json({
          data: await announceToTarget(
            deps,
            "group",
            request.params.groupId ?? "",
            requestContext(request, deps),
            input
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async stopDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(202).json({
          data: await stopDeviceAnnouncement(
            deps,
            request.params.deviceId ?? "",
            requestContext(request, deps)
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async setVolume(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseSetSpeakerVolumeInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_ANNOUNCEMENT_ERROR",
              message: "Invalid speaker volume payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(202).json({
          data: await setDeviceVolume(
            deps,
            request.params.deviceId ?? "",
            requestContext(request, deps),
            input
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async muteDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(202).json({
          data: await setDeviceMute(
            deps,
            request.params.deviceId ?? "",
            requestContext(request, deps),
            true
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async unmuteDevice(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(202).json({
          data: await setDeviceMute(
            deps,
            request.params.deviceId ?? "",
            requestContext(request, deps),
            false
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async testAudio(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseSendAnnouncementInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_ANNOUNCEMENT_ERROR",
              message: "Invalid speaker test-audio payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(202).json({
          data: await testDeviceTone(
            deps,
            request.params.deviceId ?? "",
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
