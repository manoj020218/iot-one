import type { Request, Response } from "express";

import type { IpSpeakerPlatformDeps } from "../platform-deps";
import { createAudioAsset, listAudioAssets, updateAudioAsset } from "./audio-asset.service";
import { SpeakerAudioAssetError } from "./audio-asset.types";
import { parseCreateAudioAssetInput, parseUpdateAudioAssetInput } from "./audio-asset.validation";

function sendError(response: Response, error: unknown, requestId: string): void {
  if (error instanceof SpeakerAudioAssetError) {
    response.status(error.statusCode).json({ error: { code: "AUDIO_ASSET_ERROR", message: error.message, request_id: requestId } });
    return;
  }
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal IP Speaker audio-asset error", request_id: requestId } });
}

export function createAudioAssetControllers(deps: IpSpeakerPlatformDeps) {
  return {
    async listAudioAssets(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({ error: { code: "HOME_ID_REQUIRED", message: "x-home-id is required", request_id: requestId } });
          return;
        }
        response.status(200).json({ data: await listAudioAssets(homeId) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },
    async createAudioAsset(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      const parsed = parseCreateAudioAssetInput(request.body);
      if (!parsed) {
        response.status(400).json({ error: { code: "INVALID_AUDIO_ASSET_INPUT", message: "Invalid audio asset payload", request_id: requestId } });
        return;
      }
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({ error: { code: "HOME_ID_REQUIRED", message: "x-home-id is required", request_id: requestId } });
          return;
        }
        const user = deps.requireAuthenticatedRequestUser(request);
        response.status(201).json({ data: await createAudioAsset(homeId, user.userId, parsed) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    },
    async updateAudioAsset(request: Request, response: Response) {
      const requestId = `REQ-${Date.now()}`;
      const parsed = parseUpdateAudioAssetInput(request.body);
      if (!parsed) {
        response.status(400).json({ error: { code: "INVALID_AUDIO_ASSET_INPUT", message: "Invalid audio asset patch", request_id: requestId } });
        return;
      }
      try {
        const homeId = deps.readHomeIdFromRequest(request);
        if (!homeId) {
          response.status(400).json({ error: { code: "HOME_ID_REQUIRED", message: "x-home-id is required", request_id: requestId } });
          return;
        }
        response.status(200).json({ data: await updateAudioAsset(request.params.audioId ?? "", homeId, parsed) });
      } catch (error) {
        sendError(response, error, requestId);
      }
    }
  };
}
