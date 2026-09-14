import { localDelete, localGet, localPost, localPut, localUploadFile } from "./schoolBellLocalHttp";
import type {
  AudioStatus,
  BellPreset,
  CloudConfig,
  CloudConfigPatch,
  DeviceMqttCredentialInput,
  FestivalSlot,
  Holiday,
  RingInput,
  SchedulePack,
  Schedule,
  SchoolBellConfig,
  SchoolBellConfigPatch,
  SchoolBellStatus,
  Sound
} from "./schoolBellTypes";

/**
 * One function per firmware endpoint (API_V1.md / web_service.cpp's
 * kCapabilitiesJson), each taking the device's local base URL as the
 * first argument — this module has no notion of "the current device",
 * that's the connection hook's job (schoolBellConnection.ts).
 */

export const getStatus = (baseUrl: string) => localGet<SchoolBellStatus>(baseUrl, "/status");

export const getConfig = (baseUrl: string) => localGet<SchoolBellConfig>(baseUrl, "/config");

export const updateConfig = (baseUrl: string, patch: SchoolBellConfigPatch) =>
  localPut<{ ok: boolean; persisted_to_internal_flash: boolean }>(baseUrl, "/config", patch);

export const getActiveSchedule = (baseUrl: string) =>
  localGet<{ active_profile_id: string; schedules: Schedule[] }>(baseUrl, "/schedules");

export const replaceActiveSchedule = (baseUrl: string, schedules: Schedule[]) =>
  localPut<{ ok: boolean; count: number; active_profile_id: string }>(baseUrl, "/schedules", schedules);

export const getSchedulePack = (baseUrl: string) => localGet<SchedulePack>(baseUrl, "/schedule-profiles");

export const replaceSchedulePack = (baseUrl: string, pack: SchedulePack) =>
  localPut<{ ok: boolean; profile_count: number; rule_count: number }>(baseUrl, "/schedule-profiles", pack);

export const activateProfile = (baseUrl: string, profileId: string) =>
  localPut<{ ok: boolean; active_profile_id: string }>(baseUrl, "/active-profile", { profile_id: profileId });

export const setAutomationEnabled = (baseUrl: string, enabled: boolean) =>
  localPut<{ ok: boolean; automation_enabled: boolean }>(baseUrl, "/automation", { enabled });

export const getHolidays = (baseUrl: string) => localGet<{ holidays: Holiday[] }>(baseUrl, "/holidays");

export const replaceHolidays = (baseUrl: string, holidays: Holiday[]) =>
  localPut<{ ok: boolean; count: number }>(baseUrl, "/holidays", holidays);

export const getPresets = (baseUrl: string) => localGet<{ presets: BellPreset[] }>(baseUrl, "/presets");

export const replacePresets = (baseUrl: string, presets: BellPreset[]) =>
  localPut<{ ok: boolean; count: number }>(baseUrl, "/presets", presets);

/** Combined library — every source (internal-flash, sd-card, festival-slot) in one list, each item's `source` tells them apart. */
export const getSounds = (baseUrl: string) => localGet<{ sounds: Sound[] }>(baseUrl, "/sounds");

export const getInternalSounds = (baseUrl: string) => localGet<{ sounds: Sound[] }>(baseUrl, "/internal/sounds");

/** Internal flash is the first-class store now — this is what "upload a sound" means day to day. Rejects with 507 if flash is full. */
export const uploadSound = (baseUrl: string, fileName: string, file: Blob) =>
  localUploadFile<{ ok: boolean; id: string; bytes: number }>(baseUrl, "/internal/sounds", fileName, file);

export const deleteSound = (baseUrl: string, fileName: string) =>
  localDelete<{ ok: boolean; id: string }>(baseUrl, `/sounds?name=${encodeURIComponent(fileName)}`);

export const previewUrl = (baseUrl: string, sound: Sound) => `${baseUrl}${sound.content_url}`;

export const ringBell = (baseUrl: string, input: RingInput) =>
  localPost<{ ok: boolean }>(baseUrl, "/bell/ring", input);

/** local_time must be "YYYY-MM-DDTHH:MM[:SS]" in the device's own timezone. */
export const setDeviceTime = (baseUrl: string, localTime: string) =>
  localPost<{ ok: boolean }>(baseUrl, "/time", { local_time: localTime });

export const getLogs = (baseUrl: string, limit = 200) =>
  localGet<{ logs: string[] }>(baseUrl, `/logs?limit=${limit}`);

export const clearLogs = (baseUrl: string) => localDelete<{ ok: boolean }>(baseUrl, "/logs");

/** Destructive — the caller must collect the literal "FORMAT" confirmation from the user first. */
export const formatSdCard = (baseUrl: string) =>
  localPost<{ ok: boolean; filesystem: string }>(baseUrl, "/sd/format", { confirm: "FORMAT" });

// --- Festival slot: one replaceable one-off track (see FIRMWARE_TASKS_APK_INTEGRATION.md Task 2) ---

export const getFestival = (baseUrl: string) => localGet<FestivalSlot>(baseUrl, "/festival");

export const uploadFestival = (baseUrl: string, fileName: string, file: Blob) =>
  localUploadFile<{ ok: boolean; sound_id: "festival/current"; bytes: number }>(baseUrl, "/festival/upload", fileName, file);

/** Rejects with 409 while a schedule still references "festival/current" — surface that to the caller, don't retry silently. */
export const clearFestival = (baseUrl: string) => localDelete<{ ok: boolean; cleared: boolean }>(baseUrl, "/festival");

// --- Live announcement status (Task 3/4/5 — hardware + soft PTT, priority behavior) ---

export const getAnnouncementStatus = (baseUrl: string) => localGet<AudioStatus>(baseUrl, "/announcement/status");

// --- Cloud/MQTT bridge (Task list context: manual binding, since platform provisioning is deferred) ---

export const getCloudConfig = (baseUrl: string) => localGet<CloudConfig>(baseUrl, "/cloud");

export const updateCloudConfig = (baseUrl: string, patch: CloudConfigPatch) =>
  localPut<{ ok: boolean; configured: boolean }>(baseUrl, "/cloud", patch);

/** mqttPassword is write-only — the device never returns it back (see mqttUsernameConfigured on CloudConfig instead). */
export const updateDeviceMqttCredential = (baseUrl: string, input: DeviceMqttCredentialInput) =>
  localPut<{ ok: boolean; mqttUsernameConfigured: boolean }>(baseUrl, "/device-mqtt-credential", input);
