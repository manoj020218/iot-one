/**
 * Split out of schoolBellTypes.ts to keep both files under the project's
 * 200-line-per-file rule — everything here is the newer audio/cloud
 * subsystem (internal storage sources, the festival slot, PTT status,
 * the device's MQTT bridge), added in firmware 0.6.0-flash-festival-ptt.
 * Same sourcing standard as the rest: field names copied from
 * web_service.cpp's actual JSON output, not just the capabilities schema.
 */

export type SoundSource = "internal-flash" | "sd-card" | "festival-slot";

export interface Sound {
  id: string;
  name: string;
  format: "mp3" | "wav";
  bytes: number;
  /** Real encoded-media duration in seconds; null when the header/frame sequence couldn't be parsed. */
  duration: number | null;
  source: SoundSource;
  /** Path relative to the device's own base URL, e.g. "/api/v1/sounds/content?name=...". */
  content_url: string;
}

/** GET /api/v1/festival — the one-off replaceable slot, sound_id is always "festival/current". */
export interface FestivalSlot {
  sound_id: "festival/current";
  storage: "internal-flash";
  file: Sound | null;
}

export interface StatusCloudInfo {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  homeId: string;
  ota: { active: boolean; status: string; message: string };
}

export interface CloudConfig {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  homeId: string;
  mqttHost: string;
  mqttPort: number;
  mqttUsernameConfigured: boolean;
}

export interface CloudConfigPatch {
  enabled?: boolean;
  homeId?: string;
  mqttHost?: string;
  mqttPort?: number;
}

export interface DeviceMqttCredentialInput {
  mqttUsername?: string;
  mqttPassword?: string;
  activateForCloudBroker?: boolean;
}

export type AnnouncementSource = "none" | "physical" | "soft";

export interface AudioStatus {
  busy: boolean;
  busy_reason: "none" | "bell" | "physical_announcement" | "soft_announcement";
  bell_active: boolean;
  announcement_active: boolean;
  announcement_source: AnnouncementSource;
  physical_ptt_supported: boolean;
  physical_ptt_enabled: boolean;
  physical_ptt_pressed: boolean;
  soft_ptt_supported: boolean;
  soft_ptt_active: boolean;
  physical_ptt_gpio: number;
  mic_adc_gpio: number;
  mic_adc_unit: number;
  mic_adc_channel: number;
  mic_gain_percent: number;
  collision_policy: "pause_announcement_play_bell_resume";
}
