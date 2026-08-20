import type { Request, Response } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import {
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  getSchedule,
  listSchedules,
  runScheduleNow,
  updateSchedule
} from "./schedule.service";
import { StreamerScheduleError } from "./schedule.types";
import { parseCreateScheduleInput, parseUpdateScheduleInput } from "./schedule.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof StreamerScheduleError) {
    response
      .status(error.statusCode)
      .json({ error: { code: error.code, message: error.message, request_id: requestId } });
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
    throw new StreamerScheduleError(400, "TENANT_MISMATCH", "x-home-id header is required");
  }
  return homeId;
}

export function createScheduleControllers(deps: SmartStreamerPlatformDeps) {
  return {
    async list(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(200).json({ data: await listSchedules(requireHomeId(request, deps)) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async get(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const schedule = await getSchedule(request.params.scheduleId ?? "", requireHomeId(request, deps));
        response.status(200).json({ data: schedule });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async create(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseCreateScheduleInput(request.body);
        if (!input) {
          throw new StreamerScheduleError(422, "INVALID_REQUEST", "Invalid schedule payload");
        }
        const schedule = await createSchedule(
          deps,
          requireHomeId(request, deps),
          input,
          requestContext(request, deps)
        );
        response.status(201).json({ data: schedule });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async update(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUpdateScheduleInput(request.body);
        if (!input) {
          throw new StreamerScheduleError(422, "INVALID_REQUEST", "Invalid schedule payload");
        }
        const schedule = await updateSchedule(
          deps,
          request.params.scheduleId ?? "",
          requireHomeId(request, deps),
          input,
          requestContext(request, deps)
        );
        response.status(200).json({ data: schedule });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async remove(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        await deleteSchedule(
          deps,
          request.params.scheduleId ?? "",
          requireHomeId(request, deps),
          requestContext(request, deps)
        );
        response.status(204).send();
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async duplicate(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const schedule = await duplicateSchedule(
          deps,
          request.params.scheduleId ?? "",
          requireHomeId(request, deps),
          requestContext(request, deps)
        );
        response.status(201).json({ data: schedule });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async runNow(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        await runScheduleNow(
          deps,
          request.params.scheduleId ?? "",
          requireHomeId(request, deps),
          requestContext(request, deps)
        );
        response.status(202).json({ data: { triggered: true } });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
