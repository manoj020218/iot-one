import type { DeviceRecord } from "@jenix/shared";

import { isIpSpeakerPid } from "../constants";
import type {
  IpSpeakerPlatformDeps,
  IpSpeakerRequestContext
} from "../platform-deps";
import { getSpeakerRuntimeState } from "../announcements/announcement.service";
import { SpeakerDeviceError } from "./device.types";
import type { SpeakerDeviceSummary } from "./device.types";

async function toSummary(device: DeviceRecord): Promise<SpeakerDeviceSummary> {
  const runtime = await getSpeakerRuntimeState(device.deviceId);

  return {
    deviceId: device.deviceId,
    pid: device.pid,
    friendlyName: device.displayName,
    onlineStatus: device.mqttStatus,
    cloudStatus: device.cloudStatus,
    localStatus: device.localStatus ?? "unknown",
    playbackState: device.mqttStatus === "offline" ? "OFFLINE" : runtime.playbackState,
    currentAnnouncementId: runtime.currentAnnouncementId,
    volumePercent: runtime.volumePercent,
    muted: runtime.muted,
    firmwareVersion: device.firmwareVersion ?? null,
    hardwareRevision: device.hardwareRevision ?? null,
    lastSeenAt: device.lastSeenAt ?? null
  };
}

export async function listSpeakerDevices(
  deps: IpSpeakerPlatformDeps,
  context: IpSpeakerRequestContext
): Promise<SpeakerDeviceSummary[]> {
  const devices = await deps.listDevices(context);
  const speakerDevices = devices.filter((device) => isIpSpeakerPid(device.pid));
  return Promise.all(speakerDevices.map((device) => toSummary(device)));
}

export async function getSpeakerDevice(
  deps: IpSpeakerPlatformDeps,
  deviceId: string,
  context: IpSpeakerRequestContext
): Promise<SpeakerDeviceSummary> {
  const device = await deps.getDevice(deviceId, context);

  if (!isIpSpeakerPid(device.pid)) {
    throw new SpeakerDeviceError(404, `Not an IP Speaker device: ${deviceId}`);
  }

  return toSummary(device);
}
