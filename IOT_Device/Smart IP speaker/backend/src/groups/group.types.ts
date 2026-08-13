export interface SpeakerGroupRecord {
  groupId: string;
  homeId: string;
  name: string;
  description: string | null;
  deviceIds: string[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerGroupInput {
  name: string;
  description?: string;
  deviceIds: string[];
}

export type UpdateSpeakerGroupInput = Partial<CreateSpeakerGroupInput>;

export class SpeakerGroupError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "SpeakerGroupError";
  }
}
