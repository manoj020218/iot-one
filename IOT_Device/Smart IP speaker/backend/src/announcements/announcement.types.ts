import type { DeviceUiCommandAckRecord } from "@jenix/shared";

import type {
  SpeakerPlaybackState,
  SpeakerPriority
} from "../protocol/speaker-command.types";

export interface SpeakerAudioAssetSourceInput {
  sourceType: "audio_asset";
  audioId: string;
}

export interface SpeakerUrlSourceInput {
  sourceType: "url";
  sourceUrl: string;
  title?: string;
}

export interface SpeakerToneSourceInput {
  sourceType: "tone";
  toneKey: string;
  durationSeconds?: number;
}

export type SpeakerAnnouncementSourceInput =
  | SpeakerAudioAssetSourceInput
  | SpeakerUrlSourceInput
  | SpeakerToneSourceInput;

export type SpeakerAnnouncementSource =
  | { sourceType: "audio_asset"; audioId: string; title: string }
  | { sourceType: "url"; sourceUrl: string; title: string | null }
  | { sourceType: "tone"; toneKey: string; durationSeconds: number | null };

export interface SendAnnouncementInput {
  source: SpeakerAnnouncementSourceInput;
  priority?: SpeakerPriority;
  volumePercent?: number;
}

export interface SetSpeakerVolumeInput {
  volumePercent: number;
}

export interface SpeakerRuntimeState {
  deviceId: string;
  playbackState: SpeakerPlaybackState;
  volumePercent: number | null;
  muted: boolean;
  currentAnnouncementId: string | null;
  lastCommandType: string | null;
  lastProtocolCommandId: string | null;
  updatedAt: string | null;
}

export interface DeviceDispatchResult {
  deviceId: string;
  protocolCommandId: string;
  uiCommandId: string | null;
  dispatchStatus: "accepted" | "failed";
  uiAckStatus: DeviceUiCommandAckRecord["status"] | null;
  playbackState: SpeakerPlaybackState;
  errorMessage: string | null;
}

export interface AnnouncementDispatchRecord {
  announcementId: string;
  homeId: string;
  targetKind: "device" | "group";
  targetId: string;
  requestedByUserId: string;
  source: SpeakerAnnouncementSource;
  priority: SpeakerPriority;
  volumePercent: number | null;
  requestedAt: string;
  deviceResults: DeviceDispatchResult[];
}

export interface AnnouncementDispatchSummary {
  targeted: number;
  accepted: number;
  failed: number;
  pendingPlaybackAck: number;
}

export class SpeakerAnnouncementError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "SpeakerAnnouncementError";
  }
}
