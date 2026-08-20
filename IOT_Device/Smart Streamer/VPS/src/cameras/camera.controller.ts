import type { Request, Response } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import {
  assignCamera,
  createCamera,
  deleteCamera,
  getCamera,
  getCameraTest,
  listCameras,
  startCameraTest,
  updateCamera
} from "./camera.service";
import { StreamerCameraError } from "./camera.types";
import {
  parseAssignCameraInput,
  parseCreateCameraInput,
  parseTestCameraInput,
  parseUpdateCameraInput
} from "./camera.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof StreamerCameraError) {
    response
      .status(error.statusCode)
      .json({ error: { code: "STREAMER_CAMERA_ERROR", message: error.message, request_id: requestId } });
    return;
  }

  response
    .status(500)
    .json({ error: { code: "INTERNAL_ERROR", message: "Internal Smart Streamer module error", request_id: requestId } });
}

function requireHomeId(request: Request, deps: SmartStreamerPlatformDeps): string {
  const homeId = deps.readHomeIdFromRequest(request);
  if (!homeId) {
    throw new StreamerCameraError(400, "x-home-id header is required");
  }
  return homeId;
}

export function createCameraControllers(deps: SmartStreamerPlatformDeps) {
  return {
    async list(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(200).json({ data: await listCameras(requireHomeId(request, deps)) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async get(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const camera = await getCamera(request.params.cameraId ?? "", requireHomeId(request, deps));
        response.status(200).json({ data: camera });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async create(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseCreateCameraInput(request.body);
        if (!input) {
          throw new StreamerCameraError(422, "Invalid camera payload");
        }
        const camera = await createCamera(requireHomeId(request, deps), input);
        response.status(201).json({ data: camera });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async update(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUpdateCameraInput(request.body);
        if (!input) {
          throw new StreamerCameraError(422, "Invalid camera payload");
        }
        const camera = await updateCamera(
          request.params.cameraId ?? "",
          requireHomeId(request, deps),
          input
        );
        response.status(200).json({ data: camera });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async remove(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        await deleteCamera(request.params.cameraId ?? "", requireHomeId(request, deps));
        response.status(204).send();
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async assign(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseAssignCameraInput(request.body);
        if (!input) {
          throw new StreamerCameraError(422, "deviceId is required");
        }
        const camera = await assignCamera(
          request.params.cameraId ?? "",
          requireHomeId(request, deps),
          input.deviceId
        );
        response.status(200).json({ data: camera });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async startTest(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseTestCameraInput(request.body);
        if (!input) {
          throw new StreamerCameraError(422, "deviceId is required");
        }
        const user = deps.requireAuthenticatedRequestUser(request);
        const homeId = requireHomeId(request, deps);
        const session = await startCameraTest(
          deps,
          request.params.cameraId ?? "",
          homeId,
          input.deviceId,
          { userId: user.userId, homeId }
        );
        response.status(202).json({ data: session });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async getTest(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const session = await getCameraTest(request.params.testId ?? "");
        response.status(200).json({ data: session });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
