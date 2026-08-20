import type { DeviceRecord } from "@jenix/shared";

import { getCameraIdAssignedToDevice } from "../cameras/camera.model";
import { SMART_STREAMER_PID } from "../constants";
import type { DeviceRequestContext, SmartStreamerPlatformDeps } from "../platform-deps";
import { StreamerDeviceError } from "./device.types";
import type { StreamerDeviceSummary } from "./device.types";

async function toSummary(device: DeviceRecord): Promise<StreamerDeviceSummary> {
  return {
    deviceId: device.deviceId,
    friendlyName: device.displayName,
    onlineStatus: device.mqttStatus === "online" ? "online" : "offline",
    streamState: "IDLE",
    assignedCameraId: await getCameraIdAssignedToDevice(device.deviceId),
    // TODO(#11 sessions): activeSessionId/activeDestinationPlatform once
    // the Sessions module exists.
    activeSessionId: null,
    activeDestinationPlatform: null,
    // TODO(#12 schedules): nextScheduleAt once the Schedules module exists.
    nextScheduleAt: null,
    // TODO: wifiRssi needs the telemetry runtime, not yet in
    // SmartStreamerPlatformDeps — deliberately not guessed at.
    wifiRssi: null,
    firmwareVersion: device.firmwareVersion ?? null,
    lastSeenAt: device.lastSeenAt ?? null
  };
}

export async function listStreamerDevices(
  deps: SmartStreamerPlatformDeps,
  context: DeviceRequestContext
): Promise<StreamerDeviceSummary[]> {
  const devices = await deps.listDevices(context);
  const streamerDevices = devices.filter((device) => device.pid === SMART_STREAMER_PID);
  return Promise.all(streamerDevices.map(toSummary));
}

export async function getStreamerDevice(
  deps: SmartStreamerPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<StreamerDeviceSummary> {
  const device = await deps.getDevice(deviceId, context);

  if (device.pid !== SMART_STREAMER_PID) {
    throw new StreamerDeviceError(404, `Not a Smart Streamer device: ${deviceId}`);
  }

  return toSummary(device);
}
