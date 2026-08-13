export const IP_SPEAKER_INTERNAL_KEY = "ip-speaker";
export const IP_SPEAKER_PID_PREFIX = "JNX-IPS-";
export const IP_SPEAKER_DEFAULT_TIMEZONE = "Asia/Kolkata";
export const IP_SPEAKER_PROTOCOL_SCHEMA_VERSION = 1;

export type SpeakerPermission =
  | "ipSpeaker.view"
  | "ipSpeaker.announce"
  | "ipSpeaker.emergency"
  | "ipSpeaker.schedule"
  | "ipSpeaker.audio.manage"
  | "ipSpeaker.settings"
  | "ipSpeaker.network"
  | "ipSpeaker.ota"
  | "ipSpeaker.diagnostics";

export const IP_SPEAKER_PERMISSIONS: SpeakerPermission[] = [
  "ipSpeaker.view",
  "ipSpeaker.announce",
  "ipSpeaker.emergency",
  "ipSpeaker.schedule",
  "ipSpeaker.audio.manage",
  "ipSpeaker.settings",
  "ipSpeaker.network",
  "ipSpeaker.ota",
  "ipSpeaker.diagnostics"
];

export function isIpSpeakerPid(pid: string): boolean {
  return pid.trim().toUpperCase().startsWith(IP_SPEAKER_PID_PREFIX);
}
