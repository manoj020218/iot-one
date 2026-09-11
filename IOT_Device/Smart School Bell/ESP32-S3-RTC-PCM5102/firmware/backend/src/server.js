import http from "node:http";

import { AudioProfileService } from "./audio-profiles/audio-profile.service.js";
import { createRuntimeConfig } from "./config.js";
import { readJsonBody, readRequestBuffer, sendError, sendJson, sendNoContent } from "./lib/http.js";
import { MicChannelService } from "./mic-channels/mic-channel.service.js";
import { checkBinaryAvailability, streamAudioProfileToHttpResponse } from "./streaming/transcode.service.js";

export function createSchoolBellMediaServer(overrides = {}) {
  const runtimeConfig = createRuntimeConfig(overrides);
  const audioProfileService = new AudioProfileService(runtimeConfig);
  const micChannelService = new MicChannelService(runtimeConfig);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const method = request.method ?? "GET";

      if (method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          service: "school-bell-media-backend",
          timestamp: new Date().toISOString(),
          tools: {
            ffmpeg: checkBinaryAvailability(runtimeConfig.ffmpegBin),
            ytDlp: checkBinaryAvailability(runtimeConfig.ytDlpBin)
          },
          metadata: audioProfileService.metadata()
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/audio-profiles") {
        sendJson(response, 200, {
          data: await audioProfileService.listProfiles()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/audio-profiles") {
        const payload = await readJsonBody(request, runtimeConfig.maxUploadBytes);
        sendJson(response, 201, {
          data: await audioProfileService.createProfile(payload)
        });
        return;
      }

      const profileMatch = /^\/api\/audio-profiles\/([^/]+)$/.exec(url.pathname);
      if (profileMatch && method === "GET") {
        sendJson(response, 200, {
          data: await audioProfileService.getProfile(profileMatch[1])
        });
        return;
      }

      if (profileMatch && method === "PATCH") {
        const payload = await readJsonBody(request, runtimeConfig.maxUploadBytes);
        sendJson(response, 200, {
          data: await audioProfileService.updateProfile(profileMatch[1], payload)
        });
        return;
      }

      if (profileMatch && method === "DELETE") {
        await audioProfileService.deleteProfile(profileMatch[1]);
        sendNoContent(response);
        return;
      }

      const firmwareManifestMatch = /^\/api\/audio-profiles\/([^/]+)\/firmware-manifest$/.exec(url.pathname);
      if (firmwareManifestMatch && method === "GET") {
        sendJson(response, 200, {
          data: await audioProfileService.buildFirmwareManifest(firmwareManifestMatch[1], request, {
            soundId: url.searchParams.get("soundId"),
            durationSeconds: url.searchParams.get("durationSeconds")
          })
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/mic-channels") {
        sendJson(response, 200, {
          data: await micChannelService.listChannels()
        });
        return;
      }

      const micChannelMatch = /^\/api\/mic-channels\/([^/]+)$/.exec(url.pathname);
      if (micChannelMatch && method === "GET") {
        sendJson(response, 200, {
          data: await micChannelService.getChannel(micChannelMatch[1])
        });
        return;
      }

      const micUploadMatch = /^\/api\/mic-channels\/([^/]+)\/upload$/.exec(url.pathname);
      if (micUploadMatch && method === "PUT") {
        const buffer = await readRequestBuffer(request, runtimeConfig.maxUploadBytes);
        sendJson(response, 201, {
          data: await micChannelService.saveUpload(micUploadMatch[1], request.headers, buffer)
        });
        return;
      }

      const streamMatch = /^\/streams\/([^/]+)\.wav$/.exec(url.pathname);
      if (streamMatch && method === "GET") {
        const profile = await audioProfileService.getProfile(streamMatch[1]);
        await streamAudioProfileToHttpResponse(request, response, profile, runtimeConfig, micChannelService);
        return;
      }

      sendJson(response, 404, {
        error: {
          code: "NOT_FOUND",
          message: `No route for ${method} ${url.pathname}`
        }
      });
    } catch (error) {
      sendError(response, error);
    }
  });
}
