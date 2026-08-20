import type { Request, Response } from "express";

import type { SmartStreamerPlatformDeps } from "../platform-deps";
import {
  createDestination,
  deleteDestination,
  getDestination,
  listDestinations,
  updateDestination,
  validateDestination
} from "./destination.service";
import { StreamerDestinationError } from "./destination.types";
import { parseCreateDestinationInput, parseUpdateDestinationInput } from "./destination.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof StreamerDestinationError) {
    response.status(error.statusCode).json({
      error: { code: "STREAMER_DESTINATION_ERROR", message: error.message, request_id: requestId }
    });
    return;
  }

  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal Smart Streamer module error", request_id: requestId }
  });
}

function requireHomeId(request: Request, deps: SmartStreamerPlatformDeps): string {
  const homeId = deps.readHomeIdFromRequest(request);
  if (!homeId) {
    throw new StreamerDestinationError(400, "x-home-id header is required");
  }
  return homeId;
}

export function createDestinationControllers(deps: SmartStreamerPlatformDeps) {
  return {
    async list(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        response.status(200).json({ data: await listDestinations(requireHomeId(request, deps)) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async get(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const destination = await getDestination(
          request.params.destinationId ?? "",
          requireHomeId(request, deps)
        );
        response.status(200).json({ data: destination });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async create(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseCreateDestinationInput(request.body);
        if (!input) {
          throw new StreamerDestinationError(422, "Invalid destination payload");
        }
        const destination = await createDestination(requireHomeId(request, deps), input);
        response.status(201).json({ data: destination });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async update(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const input = parseUpdateDestinationInput(request.body);
        if (!input) {
          throw new StreamerDestinationError(422, "Invalid destination payload");
        }
        const destination = await updateDestination(
          request.params.destinationId ?? "",
          requireHomeId(request, deps),
          input
        );
        response.status(200).json({ data: destination });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async remove(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        await deleteDestination(request.params.destinationId ?? "", requireHomeId(request, deps));
        response.status(204).send();
      } catch (error) {
        sendError(response, error, requestId);
      }
    },

    async validate(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const result = await validateDestination(
          request.params.destinationId ?? "",
          requireHomeId(request, deps)
        );
        response.status(200).json({ data: result });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
