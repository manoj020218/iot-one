import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../lib/app-error.js";
import { sendText } from "../lib/http.js";

export async function buildTranscodePlan(profile, runtimeConfig, micChannelService) {
  const ffmpegBin = profile.tools?.ffmpegBin || runtimeConfig.ffmpegBin;
  const ytDlpBin = profile.tools?.ytDlpBin || runtimeConfig.ytDlpBin;
  const outputArgs = buildWaveOutputArgs(profile.output);

  switch (profile.sourceType) {
    case "url":
    case "vps":
      return {
        kind: "direct-ffmpeg",
        ffmpegBin,
        ffmpegArgs: [
          "-nostdin",
          "-loglevel",
          "error",
          ...buildHeaderArgs(profile.input.headers),
          ...profile.output.extraInputArgs,
          "-i",
          profile.input.url,
          ...outputArgs
        ],
        sourceLabel: profile.input.url
      };

    case "file": {
      const filePath = resolveSourcePath(profile.input.filePath, runtimeConfig.backendRootDir);
      await assertReadable(filePath, "filePath");
      return {
        kind: "direct-ffmpeg",
        ffmpegBin,
        ffmpegArgs: [
          "-nostdin",
          "-loglevel",
          "error",
          ...profile.output.extraInputArgs,
          "-i",
          filePath,
          ...outputArgs
        ],
        sourceLabel: filePath
      };
    }

    case "rtp": {
      const inputTarget = profile.input.sdpPath
        ? resolveSourcePath(profile.input.sdpPath, runtimeConfig.backendRootDir)
        : profile.input.rtpUrl;
      if (profile.input.sdpPath) {
        await assertReadable(inputTarget, "sdpPath");
      }

      return {
        kind: "direct-ffmpeg",
        ffmpegBin,
        ffmpegArgs: [
          "-nostdin",
          "-loglevel",
          "error",
          "-protocol_whitelist",
          "file,udp,rtp,pipe,tcp,http,https,tls",
          ...profile.output.extraInputArgs,
          "-i",
          inputTarget,
          ...outputArgs
        ],
        sourceLabel: inputTarget
      };
    }

    case "youtube":
      return {
        kind: "pipe-through-ffmpeg",
        upstreamCommand: ytDlpBin,
        upstreamArgs: ["-f", "bestaudio", "-o", "-", profile.input.youtubeUrl],
        ffmpegBin,
        ffmpegArgs: [
          "-nostdin",
          "-loglevel",
          "error",
          ...profile.output.extraInputArgs,
          "-i",
          "pipe:0",
          ...outputArgs
        ],
        sourceLabel: profile.input.youtubeUrl
      };

    case "browser-mic":
    case "app-mic": {
      const uploadedPath = await micChannelService.resolveAudioPath(profile.input.micChannelId);
      await assertReadable(uploadedPath, "micChannelId");
      return {
        kind: "direct-ffmpeg",
        ffmpegBin,
        ffmpegArgs: [
          "-nostdin",
          "-loglevel",
          "error",
          ...profile.output.extraInputArgs,
          "-i",
          uploadedPath,
          ...outputArgs
        ],
        sourceLabel: uploadedPath
      };
    }

    case "sip":
      if (profile.input.bridgeCommand) {
        return {
          kind: "pipe-through-ffmpeg",
          upstreamCommand: profile.input.bridgeCommand,
          upstreamArgs: profile.input.bridgeArgs ?? [],
          ffmpegBin,
          ffmpegArgs: [
            "-nostdin",
            "-loglevel",
            "error",
            ...profile.output.extraInputArgs,
            "-i",
            "pipe:0",
            ...outputArgs
          ],
          sourceLabel: profile.input.sipUri ?? profile.input.bridgeCommand
        };
      }

      return {
        kind: "direct-ffmpeg",
        ffmpegBin,
        ffmpegArgs: [
          "-nostdin",
          "-loglevel",
          "error",
          ...profile.output.extraInputArgs,
          "-i",
          profile.input.sipUri,
          ...outputArgs
        ],
        sourceLabel: profile.input.sipUri
      };

    default:
      throw new AppError(400, "UNSUPPORTED_SOURCE_TYPE", `Unsupported sourceType: ${profile.sourceType}`);
  }
}

export async function streamAudioProfileToHttpResponse(request, response, profile, runtimeConfig, micChannelService) {
  const plan = await buildTranscodePlan(profile, runtimeConfig, micChannelService);
  const children = [];
  let responseStarted = false;

  const fail = (statusCode, message) => {
    cleanup();
    if (!responseStarted && !response.headersSent) {
      sendText(response, statusCode, message);
      return;
    }
    if (!response.writableEnded) {
      response.destroy(new Error(message));
    }
  };

  const ffmpegChild = spawn(plan.ffmpegBin, plan.ffmpegArgs, {
    stdio: plan.kind === "pipe-through-ffmpeg" ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]
  });
  children.push(ffmpegChild);

  let upstreamChild = null;
  if (plan.kind === "pipe-through-ffmpeg") {
    upstreamChild = spawn(plan.upstreamCommand, plan.upstreamArgs, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    children.push(upstreamChild);
    upstreamChild.stdout.pipe(ffmpegChild.stdin);
    upstreamChild.stdout.on("error", () => {
      ffmpegChild.stdin.destroy();
    });
  }

  const ffmpegStderr = attachStderrCapture(ffmpegChild);
  const upstreamStderr = upstreamChild ? attachStderrCapture(upstreamChild) : null;

  response.setHeader("content-type", "audio/wav");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-jenix-profile-id", profile.profileId);
  response.setHeader("x-jenix-source-type", profile.sourceType);

  ffmpegChild.stdout.once("data", (chunk) => {
    if (response.writableEnded) {
      cleanup();
      return;
    }

    responseStarted = true;
    response.writeHead(200);
    response.write(chunk);
    ffmpegChild.stdout.pipe(response);
  });

  ffmpegChild.once("error", (error) => {
    fail(502, `Unable to start ffmpeg for ${plan.sourceLabel}: ${error.message}`);
  });

  ffmpegChild.once("close", (code) => {
    if (!responseStarted) {
      fail(502, formatProcessFailureMessage("ffmpeg", code, ffmpegStderr()));
      return;
    }
    cleanup();
  });

  if (upstreamChild) {
    upstreamChild.once("error", (error) => {
      fail(502, `Unable to start upstream source process for ${plan.sourceLabel}: ${error.message}`);
    });

    upstreamChild.once("close", (code) => {
      if (code === 0) return;
      fail(502, formatProcessFailureMessage("upstream", code, upstreamStderr ? upstreamStderr() : ""));
    });
  }

  request.once("close", cleanup);

  function cleanup() {
    request.removeListener("close", cleanup);
    for (const child of children) {
      if (!child.killed) {
        child.kill();
      }
    }
  }
}

export function checkBinaryAvailability(commandName) {
  const probe = spawnSync(commandName, ["-version"], {
    stdio: "ignore",
    windowsHide: true
  });
  return probe.status === 0 && !probe.error;
}

function buildWaveOutputArgs(output) {
  return [
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ac",
    String(output.channels),
    "-ar",
    String(output.sampleRate),
    ...output.extraOutputArgs,
    "-f",
    "wav",
    "pipe:1"
  ];
}

function buildHeaderArgs(headers) {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0) return [];

  const serialized = entries.map(([key, value]) => `${key}: ${value}`).join("\r\n");
  return ["-headers", `${serialized}\r\n`];
}

function resolveSourcePath(sourcePath, backendRootDir) {
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(backendRootDir, sourcePath);
}

async function assertReadable(targetPath, fieldName) {
  try {
    await access(targetPath);
  } catch {
    throw new AppError(400, "SOURCE_PATH_NOT_FOUND", `${fieldName} is not readable: ${targetPath}`);
  }
}

function attachStderrCapture(child) {
  child.stderr.setEncoding("utf8");
  let stderrText = "";
  child.stderr.on("data", (chunk) => {
    stderrText = `${stderrText}${chunk}`.slice(-4096);
  });
  return () => stderrText.trim();
}

function formatProcessFailureMessage(label, exitCode, stderrText) {
  if (stderrText) {
    return `${label} exited with code ${exitCode ?? "unknown"}: ${stderrText}`;
  }
  return `${label} exited with code ${exitCode ?? "unknown"}`;
}
