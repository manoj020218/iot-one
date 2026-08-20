/**
 * PWA-facing shape — matches VPS/API_CONTRACT.md §1 exactly.
 *
 * Fields marked TODO are honestly nulled out until the module that owns
 * them exists: assignedCameraId needs the Cameras module (#9),
 * activeSessionId/activeDestinationPlatform need Sessions (#11),
 * nextScheduleAt needs Schedules (#12). wifiRssi/streamState need the
 * telemetry runtime, not yet wired into SmartStreamerPlatformDeps —
 * deliberately not guessed at.
 */
export interface StreamerDeviceSummary {
  deviceId: string;
  friendlyName: string;
  onlineStatus: "online" | "offline";
  streamState: string;
  assignedCameraId: string | null;
  activeSessionId: string | null;
  activeDestinationPlatform: string | null;
  nextScheduleAt: string | null;
  wifiRssi: number | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
}

export class StreamerDeviceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "StreamerDeviceError";
  }
}
