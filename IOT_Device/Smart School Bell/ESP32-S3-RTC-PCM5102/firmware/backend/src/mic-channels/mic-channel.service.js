import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../lib/app-error.js";

export class MicChannelService {
  constructor(runtimeConfig) {
    this.runtimeConfig = runtimeConfig;
  }

  async listChannels() {
    await mkdir(this.runtimeConfig.micChannelDir, { recursive: true });
    const entries = await readdir(this.runtimeConfig.micChannelDir, { withFileTypes: true });
    const metadataFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
    const records = [];

    for (const file of metadataFiles) {
      const raw = await readFile(path.join(this.runtimeConfig.micChannelDir, file.name), "utf8");
      records.push(JSON.parse(raw));
    }

    return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getChannel(channelId) {
    const metadata = await this.#readMetadata(channelId);
    if (!metadata) {
      throw new AppError(404, "MIC_CHANNEL_NOT_FOUND", `Mic channel not found: ${channelId}`);
    }
    return metadata;
  }

  async saveUpload(channelId, requestHeaders, buffer) {
    const normalizedChannelId = normalizeChannelId(channelId);
    if (!normalizedChannelId) {
      throw new AppError(400, "INVALID_MIC_CHANNEL", "channelId is required");
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError(400, "EMPTY_UPLOAD", "Audio upload body is required");
    }

    await mkdir(this.runtimeConfig.micChannelDir, { recursive: true });

    const contentType = String(requestHeaders["content-type"] ?? "application/octet-stream");
    const requestedFilename = typeof requestHeaders["x-audio-filename"] === "string"
      ? requestHeaders["x-audio-filename"]
      : "";
    const extension = selectExtension(contentType, requestedFilename);
    const audioPath = path.join(this.runtimeConfig.micChannelDir, `${normalizedChannelId}.${extension}`);
    const metadataPath = path.join(this.runtimeConfig.micChannelDir, `${normalizedChannelId}.json`);
    const now = new Date().toISOString();

    await writeFile(audioPath, buffer);

    const metadata = {
      channelId: normalizedChannelId,
      filePath: audioPath,
      contentType,
      sizeBytes: buffer.length,
      updatedAt: now,
      originalFileName: requestedFilename || null
    };

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    return metadata;
  }

  async resolveAudioPath(channelId) {
    const metadata = await this.getChannel(channelId);
    return metadata.filePath;
  }

  async #readMetadata(channelId) {
    const normalizedChannelId = normalizeChannelId(channelId);
    if (!normalizedChannelId) return null;

    const metadataPath = path.join(this.runtimeConfig.micChannelDir, `${normalizedChannelId}.json`);
    try {
      const raw = await readFile(metadataPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function normalizeChannelId(channelId) {
  if (typeof channelId !== "string") return null;
  const trimmed = channelId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function selectExtension(contentType, requestedFilename) {
  const lowerFilename = requestedFilename.toLowerCase();
  if (lowerFilename.endsWith(".wav")) return "wav";
  if (lowerFilename.endsWith(".mp3")) return "mp3";
  if (lowerFilename.endsWith(".ogg")) return "ogg";
  if (lowerFilename.endsWith(".webm")) return "webm";
  if (lowerFilename.endsWith(".aac")) return "aac";
  if (lowerFilename.endsWith(".m4a")) return "m4a";

  const lowerType = contentType.toLowerCase();
  if (lowerType.includes("wav")) return "wav";
  if (lowerType.includes("mpeg")) return "mp3";
  if (lowerType.includes("ogg")) return "ogg";
  if (lowerType.includes("webm")) return "webm";
  if (lowerType.includes("aac")) return "aac";
  if (lowerType.includes("mp4")) return "m4a";

  return "bin";
}
