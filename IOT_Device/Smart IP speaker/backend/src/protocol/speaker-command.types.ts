import { randomUUID } from "node:crypto";

import { IP_SPEAKER_PROTOCOL_SCHEMA_VERSION } from "../constants";

export type SpeakerPriority = 0 | 1 | 2;

export type SpeakerCommandType =
  | "speaker.play"
  | "speaker.stop"
  | "speaker.volume.set"
  | "speaker.mute"
  | "speaker.unmute"
  | "speaker.tone.play"
  | "speaker.status.get"
  | "speaker.config.get"
  | "speaker.config.set"
  | "speaker.reboot"
  | "speaker.ota.check"
  | "speaker.ota.apply"
  | "speaker.test.audio";

export type SpeakerPlaybackState =
  | "OFFLINE"
  | "IDLE"
  | "PENDING_DEVICE_ACK"
  | "PLAYING"
  | "FAULT"
  | "UPDATING";

export interface SpeakerCommandEnvelope<TPayload> {
  schemaVersion: number;
  commandId: string;
  deviceId: string;
  type: SpeakerCommandType;
  issuedAt: string;
  expiresAt: string;
  payload: TPayload;
}

export function createSpeakerCommandEnvelope<TPayload>(
  deviceId: string,
  type: SpeakerCommandType,
  payload: TPayload,
  ttlSeconds = 30
): SpeakerCommandEnvelope<TPayload> {
  const issuedAt = new Date();
  return {
    schemaVersion: IP_SPEAKER_PROTOCOL_SCHEMA_VERSION,
    commandId: `SPK-${randomUUID().slice(0, 8).toUpperCase()}`,
    deviceId,
    type,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + ttlSeconds * 1000).toISOString(),
    payload
  };
}
