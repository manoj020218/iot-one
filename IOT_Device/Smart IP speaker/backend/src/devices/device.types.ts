export interface SpeakerDeviceSummary {
  deviceId: string;
  pid: string;
  friendlyName: string;
  onlineStatus: "online" | "offline" | "unknown";
  cloudStatus: "online" | "offline" | "unknown";
  localStatus: "available" | "unavailable" | "unknown";
  playbackState: "OFFLINE" | "IDLE" | "PENDING_DEVICE_ACK" | "PLAYING" | "FAULT" | "UPDATING";
  currentAnnouncementId: string | null;
  volumePercent: number | null;
  muted: boolean;
  firmwareVersion: string | null;
  hardwareRevision: string | null;
  lastSeenAt: string | null;
}

export class SpeakerDeviceError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "SpeakerDeviceError";
  }
}
