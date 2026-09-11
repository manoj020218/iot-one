import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createRuntimeConfig } from "../src/config.js";
import { MicChannelService } from "../src/mic-channels/mic-channel.service.js";
import { buildTranscodePlan } from "../src/streaming/transcode.service.js";

test("buildTranscodePlan creates youtube pipeline", async () => {
  const runtimeConfig = createRuntimeConfig({
    dataDir: path.join(os.tmpdir(), "school-bell-static")
  });
  const micChannelService = new MicChannelService(runtimeConfig);

  const plan = await buildTranscodePlan({
    profileId: "APR-YT01",
    sourceType: "youtube",
    tools: {
      ffmpegBin: "ffmpeg",
      ytDlpBin: "yt-dlp"
    },
    input: {
      youtubeUrl: "https://www.youtube.com/watch?v=test"
    },
    output: {
      format: "wav",
      sampleRate: 22050,
      channels: 1,
      bitsPerSample: 16,
      extraInputArgs: [],
      extraOutputArgs: []
    }
  }, runtimeConfig, micChannelService);

  assert.equal(plan.kind, "pipe-through-ffmpeg");
  assert.equal(plan.upstreamCommand, "yt-dlp");
  assert.deepEqual(plan.upstreamArgs.slice(0, 3), ["-f", "bestaudio", "-o"]);
  assert.ok(plan.ffmpegArgs.includes("pipe:0"));
});

test("buildTranscodePlan resolves uploaded mic audio", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "school-bell-media-plan-"));
  try {
    const runtimeConfig = createRuntimeConfig({
      dataDir: tempDir
    });
    const micChannelService = new MicChannelService(runtimeConfig);
    await micChannelService.saveUpload("front-desk", { "content-type": "audio/wav" }, Buffer.from("RIFFdemo"));

    const plan = await buildTranscodePlan({
      profileId: "APR-MIC1",
      sourceType: "browser-mic",
      tools: {
        ffmpegBin: "ffmpeg",
        ytDlpBin: "yt-dlp"
      },
      input: {
        micChannelId: "front-desk"
      },
      output: {
        format: "wav",
        sampleRate: 22050,
        channels: 1,
        bitsPerSample: 16,
        extraInputArgs: [],
        extraOutputArgs: []
      }
    }, runtimeConfig, micChannelService);

    assert.equal(plan.kind, "direct-ffmpeg");
    assert.ok(plan.ffmpegArgs.includes(path.join(tempDir, "mic-channels", "front-desk.wav")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
