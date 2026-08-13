import type { SpeakerAnnouncementSourceInput } from "../announcements/announcement.types";
import type { SpeakerPriority } from "../protocol/speaker-command.types";

export type SpeakerScheduleTargetKind = "device" | "group";

export type WeekdayCode = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface SpeakerAnnouncementScheduleRecord {
  scheduleId: string;
  homeId: string;
  name: string;
  targetKind: SpeakerScheduleTargetKind;
  targetId: string;
  source: SpeakerAnnouncementSourceInput;
  timezone: string;
  localTime: string;
  daysOfWeek: WeekdayCode[];
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
  priority: SpeakerPriority;
  volumeOverridePercent: number | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerScheduleInput {
  name: string;
  targetKind: SpeakerScheduleTargetKind;
  targetId: string;
  source: SpeakerAnnouncementSourceInput;
  timezone?: string;
  localTime: string;
  daysOfWeek: WeekdayCode[];
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  priority?: SpeakerPriority;
  volumeOverridePercent?: number;
}

export type UpdateSpeakerScheduleInput = Partial<CreateSpeakerScheduleInput>;

export interface SpeakerScheduleExecutionRecord {
  eventId: string;
  scheduleId: string;
  homeId: string;
  targetKind: SpeakerScheduleTargetKind;
  targetId: string;
  requestedByUserId: string;
  executedAt: string;
  acceptedDevices: number;
  failedDevices: number;
  executionKey: string | null;
}

export interface ExecuteScheduleNowInput {
  executionKey?: string;
}

export class SpeakerScheduleError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "SpeakerScheduleError";
  }
}
