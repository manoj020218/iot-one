/**
 * Shaped like GET /api/v1/streamer/sessions/:sessionId in
 * VPS/API_CONTRACT.md §5 — every field listed there is present so the
 * detail page does no client-side derivation, matching Streamer
 * Plugin.txt §11.
 */
export interface StreamerSessionSummary {
  sessionId: string;
  deviceId: string;
  cameraId: string;
  destinationId: string;
  platform: "youtube" | "facebook" | "instagram";
  status: "STREAMING" | "STOPPED" | "FAILED";
  triggerSource: "schedule" | "manual" | "recovery" | "api";
  videoMode: string;
  audioMode: string;
  connectionStatus: string;
  reconnectCount: number;
  currentBitrateKbps: number | null;
  startTime: string;
  plannedStopAt: string | null;
  stoppedAt: string | null;
}

export const DEMO_STREAMER_SESSIONS: StreamerSessionSummary[] = [
  {
    sessionId: "SES-20260804-0012",
    deviceId: "JNX-P4-000102",
    cameraId: "CAM-0002",
    destinationId: "DEST-00011",
    platform: "youtube",
    status: "STREAMING",
    triggerSource: "schedule",
    videoMode: "h264_passthrough",
    audioMode: "aac_passthrough",
    connectionStatus: "connected",
    reconnectCount: 0,
    currentBitrateKbps: 4200,
    startTime: "2026-08-04T12:30:00Z",
    plannedStopAt: "2026-08-04T13:30:00Z",
    stoppedAt: null
  },
  {
    sessionId: "SES-20260803-0007",
    deviceId: "JNX-P4-000101",
    cameraId: "CAM-0001",
    destinationId: "DEST-00017",
    platform: "instagram",
    status: "STOPPED",
    triggerSource: "manual",
    videoMode: "h264_passthrough",
    audioMode: "aac_passthrough",
    connectionStatus: "disconnected",
    reconnectCount: 1,
    currentBitrateKbps: null,
    startTime: "2026-08-03T09:00:00Z",
    plannedStopAt: null,
    stoppedAt: "2026-08-03T10:32:00Z"
  }
];
