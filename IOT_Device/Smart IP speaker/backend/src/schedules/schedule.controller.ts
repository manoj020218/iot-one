import type { Request, Response } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import {
  createSpeakerSchedule,
  executeSpeakerScheduleNow,
  getSpeakerSchedule,
  listSpeakerScheduleExecutions,
  listSpeakerSchedules,
  updateSpeakerSchedule
} from "./schedule.service";
import { SpeakerScheduleError } from "./schedule.types";
import {
  parseCreateSpeakerScheduleInput,
  parseExecuteScheduleNowInput,
  parseUpdateSpeakerScheduleInput
} from "./schedule.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof SpeakerScheduleError) {
    response.status(error.statusCode).json({
      error: { code: "IP_SPEAKER_SCHEDULE_ERROR", message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal IP Speaker schedule module error",
      request_id: requestId
    }
  });
}

function requestContext(request: Request, deps: IpSpeakerPlatformDeps) {
  const user = deps.requireAuthenticatedRequestUser(request);
  const homeId = deps.readHomeIdFromRequest(request);
  return { userId: user.userId, ...(homeId ? { homeId } : {}) };
}

export function createSpeakerScheduleControllers(deps: IpSpeakerPlatformDeps) {
  return {
    async listSchedules(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_SCHEDULE_ERROR",
              message: "homeId is required",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({ data: await listSpeakerSchedules(homeId) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async getSchedule(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_SCHEDULE_ERROR",
              message: "homeId is required",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({
          data: await getSpeakerSchedule(request.params.scheduleId ?? "", homeId)
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async createSchedule(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseCreateSpeakerScheduleInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_SCHEDULE_ERROR",
              message: "Invalid speaker schedule payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(201).json({
          data: await createSpeakerSchedule(deps, requestContext(request, deps), input)
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async updateSchedule(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUpdateSpeakerScheduleInput(request.body);
        if (!input) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_SCHEDULE_ERROR",
              message: "Invalid speaker schedule patch payload",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({
          data: await updateSpeakerSchedule(
            deps,
            request.params.scheduleId ?? "",
            requestContext(request, deps),
            input
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async listExecutions(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({
            error: {
              code: "IP_SPEAKER_SCHEDULE_ERROR",
              message: "homeId is required",
              request_id: requestId
            }
          });
          return;
        }

        response.status(200).json({
          data: await listSpeakerScheduleExecutions(
            request.params.scheduleId ?? "",
            homeId
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async executeNow(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(202).json({
          data: await executeSpeakerScheduleNow(
            deps,
            request.params.scheduleId ?? "",
            requestContext(request, deps),
            parseExecuteScheduleNowInput(request.body)
          )
        });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
