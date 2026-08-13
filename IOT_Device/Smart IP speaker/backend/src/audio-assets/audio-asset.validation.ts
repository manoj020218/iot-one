import type {
  CreateSpeakerAudioAssetInput,
  SpeakerAudioCategory,
  UpdateSpeakerAudioAssetInput
} from "./audio-asset.types";

const CATEGORIES: SpeakerAudioCategory[] = [
  "General",
  "Emergency",
  "Bell",
  "Prayer",
  "Factory",
  "Custom"
];

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

function readCategory(body: Record<string, unknown>): SpeakerAudioCategory | undefined {
  const value = body.category;
  return typeof value === "string" && CATEGORIES.includes(value as SpeakerAudioCategory)
    ? (value as SpeakerAudioCategory)
    : undefined;
}

function optionalProp<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseCreateAudioAssetInput(body: unknown): CreateSpeakerAudioAssetInput | null {
  if (!isRecord(body)) {
    return null;
  }
  const title = readString(body, "title");
  const durationSeconds = readNumber(body, "durationSeconds");
  const fileType = readString(body, "fileType");
  const sizeBytes = readNumber(body, "sizeBytes");

  if (!title || durationSeconds === undefined || !fileType || sizeBytes === undefined) {
    return null;
  }

  return {
    title,
    durationSeconds,
    fileType,
    sizeBytes,
    ...optionalProp("description", readString(body, "description")),
    ...optionalProp("category", readCategory(body)),
    ...optionalProp("sourceUrl", readString(body, "sourceUrl"))
  };
}

export function parseUpdateAudioAssetInput(body: unknown): UpdateSpeakerAudioAssetInput | null {
  if (!isRecord(body)) {
    return null;
  }
  return {
    ...optionalProp("title", readString(body, "title")),
    ...optionalProp("description", readString(body, "description")),
    ...optionalProp("category", readCategory(body)),
    ...optionalProp("durationSeconds", readNumber(body, "durationSeconds")),
    ...optionalProp("fileType", readString(body, "fileType")),
    ...optionalProp("sizeBytes", readNumber(body, "sizeBytes")),
    ...optionalProp("sourceUrl", readString(body, "sourceUrl"))
  };
}
