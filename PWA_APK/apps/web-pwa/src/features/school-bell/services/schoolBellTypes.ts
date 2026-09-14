/**
 * Wire types for the ESP32-S3 School Bell's own local HTTP API
 * (base path /api/v1, port 80, served directly by the device — see
 * IOT_Device/Smart School Bell/ESP32-S3-RTC-PCM5102/firmware/API_V1.md).
 * Field names are copied verbatim from the firmware's actual JSON
 * serialization in src/services/web_service.cpp (renderStatus/
 * renderConfig/etc.), not just the abbreviated capabilities schema, so
 * this is the real wire shape, not a guess.
 *
 * Audio/cloud/festival/PTT types live in schoolBellAudioCloudTypes.ts —
 * split out to keep both files under the project's 200-line rule.
 */
import type { AudioStatus, StatusCloudInfo } from "./schoolBellAudioCloudTypes";

export * from "./schoolBellAudioCloudTypes";

export type ScheduleProfileCategory = "regular" | "summer" | "winter" | "exam" | "custom";
export type HolidayType = "holiday" | "closed" | "event";

export interface SchoolBellStatus {
  ok: boolean;
  firmware_version: string;
  api_version: string;
  pid: string;
  state: string;
  time_valid: boolean;
  internal_storage_ready: boolean;
  /** True only when a physical SD card is inserted and mounted — internal flash is the primary store now. */
  sd_ready: boolean;
  internal_storage?: { total_bytes: number; used_bytes: number; free_bytes: number };
  wifi_ready: boolean;
  station_connected: boolean;
  station_ssid: string;
  /** LAN IP once joined to school Wi-Fi — the value to offer as the local address once seen. */
  station_ip: string;
  ap_ssid: string;
  ap_url: string;
  mdns_hostname: string;
  mdns_url: string;
  sync_in_progress: boolean;
  content_version: number;
  device_id: string;
  school_name: string;
  timezone: string;
  timezone_posix: string;
  clock_source: "ds3231_rtc";
  last_fault: string;
  active_profile_id: string;
  automation_enabled: boolean;
  audio: AudioStatus;
  cloud: StatusCloudInfo;
  /** ISO-ish "YYYY-MM-DDTHH:MM:SS" in the device's own timezone, or null if the RTC has no valid time yet. */
  local_time: string | null;
  unix_time: number | null;
  local_date: string | null;
  weekday: string | null;
  resolved_profile_id: string;
  holiday_today: boolean;
}

export interface SchoolBellConfig {
  pid: string;
  device_id: string;
  school_name: string;
  timezone: string;
  timezone_posix: string;
  volume_percent: number;
  wifi: { mode: "client"; ssid: string; password_set: boolean };
}

export interface SchoolBellConfigPatch {
  school_name?: string;
  timezone?: string;
  timezone_posix?: string;
  volume_percent?: number;
  announcement?: { physical_ptt_enabled?: boolean; mic_gain_percent?: number };
}

export interface Schedule {
  id: number;
  name: string;
  time: string; // "HH:MM"
  type: string;
  sound_id: string;
  duration: number;
  days: number[]; // 0=Sunday..6=Saturday
  enabled: boolean;
}

export interface ScheduleProfile {
  id: string;
  name: string;
  category: ScheduleProfileCategory;
  enabled: boolean;
  schedules: Schedule[];
}

export interface CalendarRule {
  id: number;
  name: string;
  profile_id: string;
  start_date?: string; // "YYYY-MM-DD"
  end_date?: string;
  priority: number;
  repeat_yearly: boolean;
  days: number[];
  enabled: boolean;
}

export interface SchedulePack {
  active_profile_id: string;
  automation_enabled: boolean;
  profiles: ScheduleProfile[];
  calendar_rules: CalendarRule[];
}

export interface Holiday {
  date: string; // "YYYY-MM-DD"
  name: string;
  type: HolidayType;
}

export interface BellPreset {
  id: number | string;
  label: string;
  sound_id: string;
  duration: number;
  category: string;
}

export interface RingInput {
  name?: string;
  soundId: string;
  duration: number;
}

export interface Capabilities {
  api_version: string;
  base_path: string;
  transport: string;
  actions: Array<{ id: string; method: string; path: string }>;
}
