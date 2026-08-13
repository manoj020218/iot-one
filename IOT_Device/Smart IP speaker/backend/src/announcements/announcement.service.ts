import { randomUUID } from "node:crypto";

import type { DeviceRecord } from "@jenix/shared";

import { getAudioAsset } from "../audio-assets/audio-asset.service";
import { isIpSpeakerPid } from "../constants";
import { getSpeakerGroup } from "../groups/group.service";
import type {
  IpSpeakerPlatformDeps,
  IpSpeakerRequestContext
} from "../platform-deps";
import {
  createSpeakerCommandEnvelope,
  type SpeakerCommandType
} from "../protocol/speaker-command.types";
import { announcementRepository } from "./announcement.model";
import type {
  AnnouncementDispatchRecord,
  AnnouncementDispatchSummary,
  DeviceDispatchResult,
  SendAnnouncementInput,
  SetSpeakerVolumeInput,
  SpeakerAnnouncementSource,
  SpeakerAnnouncementSourceInput,
  SpeakerRuntimeState
} from "./announcement.types";
import { SpeakerAnnouncementError } from "./announcement.types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown IP Speaker command failure";
}

async function requireSpeakerDevice(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext
): Promise<DeviceRecord> {
  const device = await deps.getDevice(deviceId, context);

  if (!isIpSpeakerPid(device.pid)) {
    throw new SpeakerAnnouncementError(404, `Not an IP Speaker device: ${deviceId}`);
  }

  if (context.homeId && device.homeId !== context.homeId) {
    throw new SpeakerAnnouncementError(403, `Device does not belong to home: ${deviceId}`);
  }

  return device;
}

async function normalizeSource(
  homeId: string,
  source: SpeakerAnnouncementSourceInput
): Promise<SpeakerAnnouncementSource> {
  if (source.sourceType === "audio_asset") {
    const audioAsset = await getAudioAsset(source.audioId, homeId);
    return {
      sourceType: "audio_asset",
      audioId: audioAsset.audioId,
      title: audioAsset.title
    };
  }

  if (source.sourceType === "url") {
    const url = new URL(source.sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new SpeakerAnnouncementError(400, "Only http/https announcement URLs are allowed");
    }
    return {
      sourceType: "url",
      sourceUrl: url.toString(),
      title: source.title ?? null
    };
  }

  if (source.durationSeconds !== undefined && source.durationSeconds <= 0) {
    throw new SpeakerAnnouncementError(400, "Tone durationSeconds must be positive");
  }

  return {
    sourceType: "tone",
    toneKey: source.toneKey,
    durationSeconds: source.durationSeconds ?? null
  };
}

async function resolveTargetDeviceIds(
  deps: IpSpeakerPlatformDeps,
  targetKind: "device" | "group",
  targetId: string,
  context: IpSpeakerRequestContext
): Promise<string[]> {
  if (targetKind === "device") {
    const device = await requireSpeakerDevice(deps, targetId, context);
    return [device.deviceId];
  }

  if (!context.homeId) {
    throw new SpeakerAnnouncementError(400, "Home context is required for group targeting");
  }

  const group = await getSpeakerGroup(targetId, context.homeId);
  return group.deviceIds;
}

async function saveRuntimeState(
  deviceId: string,
  patch: Partial<SpeakerRuntimeState>,
  lastCommandType: SpeakerCommandType,
  protocolCommandId: string
): Promise<SpeakerRuntimeState> {
  const current = await announcementRepository.getDeviceState(deviceId);
  return announcementRepository.saveDeviceState({
    ...current,
    ...patch,
    deviceId,
    lastCommandType,
    lastProtocolCommandId: protocolCommandId,
    updatedAt: new Date().toISOString()
  });
}

async function dispatchSpeakerCommand(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext,
  type: SpeakerCommandType,
  payload: Record<string, unknown>,
  runtimePatch: Partial<SpeakerRuntimeState>
): Promise<DeviceDispatchResult> {
  const device = await requireSpeakerDevice(deps, deviceId, context);
  const envelope = createSpeakerCommandEnvelope(device.deviceId, type, payload);

  try {
    const ack = await deps.dispatchDeviceUiCommand(
      device.deviceId,
      {
        command: type,
        payload: envelope as unknown as Record<string, unknown>,
        requiresAck: true
      },
      context
    );
    const runtime = await saveRuntimeState(
      device.deviceId,
      runtimePatch,
      type,
      envelope.commandId
    );

    return {
      deviceId: device.deviceId,
      protocolCommandId: envelope.commandId,
      uiCommandId: ack.commandId,
      dispatchStatus: "accepted",
      uiAckStatus: ack.status,
      playbackState: runtime.playbackState,
      errorMessage: null
    };
  } catch (error) {
    const runtime = await saveRuntimeState(device.deviceId, {}, type, envelope.commandId);
    return {
      deviceId: device.deviceId,
      protocolCommandId: envelope.commandId,
      uiCommandId: null,
      dispatchStatus: "failed",
      uiAckStatus: null,
      playbackState: runtime.playbackState,
      errorMessage: toErrorMessage(error)
    };
  }
}

function summarizeResults(
  results: DeviceDispatchResult[]
): AnnouncementDispatchSummary {
  return {
    targeted: results.length,
    accepted: results.filter((result) => result.dispatchStatus === "accepted").length,
    failed: results.filter((result) => result.dispatchStatus === "failed").length,
    pendingPlaybackAck: results.filter(
      (result) => result.playbackState === "PENDING_DEVICE_ACK"
    ).length
  };
}

export function listRecentAnnouncements(
  homeId: string
): Promise<AnnouncementDispatchRecord[]> {
  return announcementRepository.listByHome(homeId);
}

export function getSpeakerRuntimeState(deviceId: string): Promise<SpeakerRuntimeState> {
  return announcementRepository.getDeviceState(deviceId);
}

export async function announceToTarget(
  deps: IpSpeakerPlatformDeps,
  targetKind: "device" | "group",
  targetId: string,
  context: IpSpeakerRequestContext,
  input: SendAnnouncementInput
) {
  if (!context.homeId || !context.userId) {
    throw new SpeakerAnnouncementError(400, "Authenticated home context is required");
  }

  const announcementId = `ANN-${randomUUID().slice(0, 8).toUpperCase()}`;
  const priority = input.priority ?? 0;
  const source = await normalizeSource(context.homeId, input.source);
  const deviceIds = await resolveTargetDeviceIds(deps, targetKind, targetId, context);
  const payload: Record<string, unknown> = {
    announcementId,
    priority,
    source,
    ...(input.volumePercent !== undefined ? { volumePercent: input.volumePercent } : {})
  };

  const deviceResults = await Promise.all(
    deviceIds.map((deviceId) =>
      dispatchSpeakerCommand(deps, deviceId, context, "speaker.play", payload, {
        playbackState: "PENDING_DEVICE_ACK",
        currentAnnouncementId: announcementId,
        ...(input.volumePercent !== undefined
          ? { volumePercent: input.volumePercent }
          : {})
      })
    )
  );

  const record: AnnouncementDispatchRecord = {
    announcementId,
    homeId: context.homeId,
    targetKind,
    targetId,
    requestedByUserId: context.userId,
    source,
    priority,
    volumePercent: input.volumePercent ?? null,
    requestedAt: new Date().toISOString(),
    deviceResults
  };

  return {
    dispatch: await announcementRepository.saveDispatch(record),
    summary: summarizeResults(deviceResults)
  };
}

export function stopDeviceAnnouncement(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext
): Promise<DeviceDispatchResult> {
  return dispatchSpeakerCommand(deps, deviceId, context, "speaker.stop", {}, {
    playbackState: "IDLE",
    currentAnnouncementId: null
  });
}

export function setDeviceVolume(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext,
  input: SetSpeakerVolumeInput
): Promise<DeviceDispatchResult> {
  return dispatchSpeakerCommand(
    deps,
    deviceId,
    context,
    "speaker.volume.set",
    { volumePercent: input.volumePercent },
    { volumePercent: input.volumePercent }
  );
}

export function setDeviceMute(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext,
  muted: boolean
): Promise<DeviceDispatchResult> {
  return dispatchSpeakerCommand(
    deps,
    deviceId,
    context,
    muted ? "speaker.mute" : "speaker.unmute",
    {},
    { muted }
  );
}

export async function testDeviceTone(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext,
  input: SendAnnouncementInput
): Promise<DeviceDispatchResult> {
  if (input.source.sourceType !== "tone") {
    throw new SpeakerAnnouncementError(400, "speaker.test.audio only supports tone sources");
  }

  const source = await normalizeSource(context.homeId ?? "", input.source);
  return dispatchSpeakerCommand(deps, deviceId, context, "speaker.test.audio", { source }, {
    playbackState: "PENDING_DEVICE_ACK"
  });
}

export const announcementTesting = {
  reset: () => announcementRepository.reset()
};
