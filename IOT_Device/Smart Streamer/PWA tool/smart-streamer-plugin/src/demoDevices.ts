import type { StreamerPlatform } from "./demoDestinations";

/**
 * Placeholder data shaped exactly like GET /api/v1/streamer/devices in
 * VPS/API_CONTRACT.md §1. Swap for a real fetch once that endpoint ships
 * — every field here already matches the contract, so that swap should
 * only touch the fetch call, not the pages consuming this shape.
 */
export interface StreamerDeviceSummary {
  deviceId: string;
  friendlyName: string;
  onlineStatus: "online" | "offline";
  streamState: string;
  assignedCameraId: string | null;
  activeSessionId: string | null;
  activeDestinationPlatform: StreamerPlatform | null;
  nextScheduleAt: string | null;
  wifiRssi: number;
  firmwareVersion: string;
  lastSeenAt: string;
}

export const DEMO_STREAMER_DEVICES: StreamerDeviceSummary[] = [
  {
    deviceId: "JNX-P4-000101",
    friendlyName: "Front Gate Camera",
    onlineStatus: "online",
    streamState: "IDLE",
    assignedCameraId: "CAM-0001",
    activeSessionId: null,
    activeDestinationPlatform: null,
    nextScheduleAt: "2026-08-04T18:00:00+05:30",
    wifiRssi: -58,
    firmwareVersion: "1.0.0",
    lastSeenAt: "2026-08-04T10:02:11Z"
  },
  {
    deviceId: "JNX-P4-000102",
    friendlyName: "Prayer Hall Camera",
    onlineStatus: "online",
    streamState: "STREAMING",
    assignedCameraId: "CAM-0002",
    activeSessionId: "SES-20260804-0012",
    activeDestinationPlatform: "youtube",
    nextScheduleAt: null,
    wifiRssi: -61,
    firmwareVersion: "1.0.0",
    lastSeenAt: "2026-08-04T11:15:40Z"
  }
];
