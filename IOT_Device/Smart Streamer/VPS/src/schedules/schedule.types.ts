// PWA-facing shape — matches VPS/API_CONTRACT.md §4 (corrected version:
// this is stored here in Smart Streamer's own record, and PROJECTED into
// a pair of Scenes for actual triggering — see schedule.service.ts's
// top-of-file comment for why).
export type WeekdayCode = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export const WEEKDAY_ORDER: WeekdayCode[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface StreamerScheduleSummary {
  scheduleId: string;
  homeId: string;
  name: string;
  deviceId: string;
  cameraId: string;
  destinationId: string;
  timezone: string;
  startLocalTime: string;
  stopLocalTime: string;
  daysOfWeek: WeekdayCode[];
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// Internal record — the two Scene IDs are what actually make this fire.
export interface StreamerScheduleRecord extends StreamerScheduleSummary {
  startSceneId: string;
  stopSceneId: string;
}

export interface CreateScheduleInput {
  name: string;
  deviceId: string;
  cameraId: string;
  destinationId: string;
  timezone?: string;
  startLocalTime: string;
  stopLocalTime: string;
  daysOfWeek: WeekdayCode[];
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  priority?: number;
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>;

export class StreamerScheduleError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "StreamerScheduleError";
  }
}
