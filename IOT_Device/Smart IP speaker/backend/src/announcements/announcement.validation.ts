import type {
  SendAnnouncementInput,
  SetSpeakerVolumeInput,
  SpeakerAnnouncementSourceInput
} from "./announcement.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPriority(body: Record<string, unknown>): 0 | 1 | 2 | undefined {
  const value = body.priority;
  return value === 0 || value === 1 || value === 2 ? value : undefined;
}

function readVolumePercent(body: Record<string, unknown>): number | undefined {
  const value = readNumber(body, "volumePercent");
  return value !== undefined && value >= 0 && value <= 100 ? value : undefined;
}

function parseSource(body: Record<string, unknown>): SpeakerAnnouncementSourceInput | null {
  const source = body.source;
  if (!isRecord(source)) {
    return null;
  }

  const sourceType = readString(source, "sourceType");
  if (sourceType === "audio_asset") {
    const audioId = readString(source, "audioId");
    return audioId ? { sourceType, audioId } : null;
  }

  if (sourceType === "url") {
    const sourceUrl = readString(source, "sourceUrl");
    const title = readString(source, "title");
    return sourceUrl ? { sourceType, sourceUrl, ...(title ? { title } : {}) } : null;
  }

  if (sourceType === "tone") {
    const toneKey = readString(source, "toneKey");
    const durationSeconds = readNumber(source, "durationSeconds");
    return toneKey
      ? {
          sourceType,
          toneKey,
          ...(durationSeconds !== undefined ? { durationSeconds } : {})
        }
      : null;
  }

  return null;
}

export function parseSendAnnouncementInput(body: unknown): SendAnnouncementInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const source = parseSource(body);
  const priority = readPriority(body);
  const volumePercent = readVolumePercent(body);
  if (!source) {
    return null;
  }

  return {
    source,
    ...(priority !== undefined ? { priority } : {}),
    ...(volumePercent !== undefined ? { volumePercent } : {})
  };
}

export function parseSetSpeakerVolumeInput(
  body: unknown
): SetSpeakerVolumeInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const volumePercent = readVolumePercent(body);
  return volumePercent !== undefined ? { volumePercent } : null;
}
