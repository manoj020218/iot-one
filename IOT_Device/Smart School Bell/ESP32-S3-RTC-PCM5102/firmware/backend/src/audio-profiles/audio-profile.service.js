import { randomUUID } from "node:crypto";

import { AppError } from "../lib/app-error.js";
import { getPublicBaseUrl } from "../lib/http.js";
import { AudioProfileStore } from "./audio-profile.store.js";
import { supportedSourceTypes, validateAudioProfileInput } from "./audio-profile.validation.js";

export class AudioProfileService {
  constructor(runtimeConfig) {
    this.runtimeConfig = runtimeConfig;
    this.store = new AudioProfileStore(runtimeConfig);
  }

  async listProfiles() {
    const records = await this.store.list();
    return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async getProfile(profileId) {
    const record = await this.store.get(String(profileId).trim());
    if (!record) {
      throw new AppError(404, "PROFILE_NOT_FOUND", `Audio profile not found: ${profileId}`);
    }
    return record;
  }

  async createProfile(payload) {
    const parsed = safelyValidate(payload, this.runtimeConfig);
    const now = new Date().toISOString();
    const record = {
      profileId: `APR-${randomUUID().slice(0, 8).toUpperCase()}`,
      ...parsed,
      createdAt: now,
      updatedAt: now
    };

    return await this.store.save(record);
  }

  async updateProfile(profileId, patch) {
    const existing = await this.getProfile(profileId);
    const merged = {
      name: patch?.name ?? existing.name,
      sourceType: patch?.sourceType ?? existing.sourceType,
      enabled: patch?.enabled ?? existing.enabled,
      notes: patch?.notes ?? existing.notes,
      input: patch?.input ? { ...existing.input, ...patch.input } : existing.input,
      output: patch?.output ? { ...existing.output, ...patch.output } : existing.output,
      tools: patch?.tools ? { ...existing.tools, ...patch.tools } : existing.tools
    };

    const parsed = safelyValidate(merged, this.runtimeConfig);
    const record = {
      ...existing,
      ...parsed,
      updatedAt: new Date().toISOString()
    };

    return await this.store.save(record);
  }

  async deleteProfile(profileId) {
    const deleted = await this.store.delete(String(profileId).trim());
    if (!deleted) {
      throw new AppError(404, "PROFILE_NOT_FOUND", `Audio profile not found: ${profileId}`);
    }
  }

  async buildFirmwareManifest(profileId, request, options = {}) {
    const profile = await this.getProfile(profileId);
    const publicBaseUrl = getPublicBaseUrl(request, this.runtimeConfig);
    const streamUrl = `${publicBaseUrl}/streams/${profile.profileId}.wav`;
    const soundId = normalizeSoundId(options.soundId);
    const durationSeconds = normalizeDurationSeconds(options.durationSeconds);
    const transport = streamUrl.startsWith("https://") ? "https" : "http";

    return {
      upstream: {
        sourceType: profile.sourceType,
        enabled: profile.enabled
      },
      streamUrl,
      manifest: {
        profiles: {
          [profile.profileId]: {
            name: profile.name,
            source: profile.sourceType === "vps" ? "vps" : "url",
            transport,
            format: "wav",
            endpoint: streamUrl,
            enabled: profile.enabled
          }
        },
        sounds: {
          [soundId]: {
            profile: profile.profileId,
            duration: durationSeconds
          }
        }
      }
    };
  }

  metadata() {
    return {
      supportedSourceTypes: supportedSourceTypes(),
      canonicalOutput: this.runtimeConfig.canonicalWave
    };
  }
}

function safelyValidate(payload, runtimeConfig) {
  try {
    const parsed = validateAudioProfileInput(payload, runtimeConfig);
    if (!parsed.ok) {
      throw new AppError(400, "INVALID_PROFILE", parsed.error);
    }
    return parsed.value;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_PROFILE", error instanceof Error ? error.message : "Invalid profile");
  }
}

function normalizeSoundId(value) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function normalizeDurationSeconds(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
