export type SpeakerAudioCategory =
  | "General"
  | "Emergency"
  | "Bell"
  | "Prayer"
  | "Factory"
  | "Custom";

export interface SpeakerAudioAssetRecord {
  audioId: string;
  homeId: string;
  title: string;
  description: string | null;
  category: SpeakerAudioCategory;
  durationSeconds: number;
  fileType: string;
  sizeBytes: number;
  sourceUrl: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerAudioAssetInput {
  title: string;
  description?: string;
  category?: SpeakerAudioCategory;
  durationSeconds: number;
  fileType: string;
  sizeBytes: number;
  sourceUrl?: string;
}

export type UpdateSpeakerAudioAssetInput = Partial<CreateSpeakerAudioAssetInput>;

export class SpeakerAudioAssetError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "SpeakerAudioAssetError";
  }
}
