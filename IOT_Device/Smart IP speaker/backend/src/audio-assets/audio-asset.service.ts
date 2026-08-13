import { randomUUID } from "node:crypto";

import { audioAssetRepository } from "./audio-asset.model";
import type {
  CreateSpeakerAudioAssetInput,
  SpeakerAudioAssetRecord,
  UpdateSpeakerAudioAssetInput
} from "./audio-asset.types";
import { SpeakerAudioAssetError } from "./audio-asset.types";

export function listAudioAssets(homeId: string): Promise<SpeakerAudioAssetRecord[]> {
  return audioAssetRepository.listByHome(homeId);
}

export async function getAudioAsset(
  audioId: string,
  homeId: string
): Promise<SpeakerAudioAssetRecord> {
  const record = await audioAssetRepository.get(audioId.trim());
  if (!record || record.homeId !== homeId) {
    throw new SpeakerAudioAssetError(404, `Audio asset not found: ${audioId.trim()}`);
  }
  return record;
}

export async function createAudioAsset(
  homeId: string,
  createdByUserId: string,
  input: CreateSpeakerAudioAssetInput
): Promise<SpeakerAudioAssetRecord> {
  const now = new Date().toISOString();
  const record: SpeakerAudioAssetRecord = {
    audioId: `AUD-${randomUUID().slice(0, 8).toUpperCase()}`,
    homeId,
    title: input.title,
    description: input.description ?? null,
    category: input.category ?? "Custom",
    durationSeconds: input.durationSeconds,
    fileType: input.fileType,
    sizeBytes: input.sizeBytes,
    sourceUrl: input.sourceUrl ?? null,
    createdByUserId,
    createdAt: now,
    updatedAt: now
  };
  return audioAssetRepository.save(record);
}

export async function updateAudioAsset(
  audioId: string,
  homeId: string,
  input: UpdateSpeakerAudioAssetInput
): Promise<SpeakerAudioAssetRecord> {
  const existing = await getAudioAsset(audioId, homeId);
  const updated: SpeakerAudioAssetRecord = {
    ...existing,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
    ...(input.fileType !== undefined ? { fileType: input.fileType } : {}),
    ...(input.sizeBytes !== undefined ? { sizeBytes: input.sizeBytes } : {}),
    ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl ?? null } : {}),
    updatedAt: new Date().toISOString()
  };
  return audioAssetRepository.save(updated);
}

export const audioAssetTesting = {
  reset: () => audioAssetRepository.reset()
};
