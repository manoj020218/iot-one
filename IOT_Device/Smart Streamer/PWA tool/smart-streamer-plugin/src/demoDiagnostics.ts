/**
 * Shaped like GET /api/v1/streamer/devices/:deviceId/health in
 * VPS/API_CONTRACT.md §6 — a passthrough of the device heartbeat
 * (firmware/API_CONTRACT.md §6) plus VPS-computed fields. Field list
 * matches Streamer Plugin.txt §15 exactly. Note what's never here: camera
 * password, stream key, device signing key, WiFi password, complete
 * authenticated RTSP URL.
 */
export interface StreamerDeviceHealth {
  deviceId: string;
  onlineStatus: "online" | "offline";
  lastSeenAt: string;
  uptimeSeconds: number;
  resetReason: string;
  freeHeap: number;
  minFreeHeap: number;
  largestFreeBlock: number;
  psramStatus: string;
  wifiRssi: number;
  ipAddress: string;
  timeSynchronized: boolean;
  cameraConnection: "connected" | "disconnected";
  rtspState: string;
  rtmpState: string;
  currentSessionId: string | null;
  reconnectCount: number;
  lastError: string | null;
  firmwareVersion: string;
  hardwareRevision: string;
}

export const DEMO_DEVICE_HEALTH: StreamerDeviceHealth[] = [
  {
    deviceId: "JNX-P4-000101",
    onlineStatus: "online",
    lastSeenAt: "2026-08-04T10:02:11Z",
    uptimeSeconds: 86200,
    resetReason: "power_on",
    freeHeap: 183000,
    minFreeHeap: 151000,
    largestFreeBlock: 92000,
    psramStatus: "ok, 6.1 MB free",
    wifiRssi: -58,
    ipAddress: "192.168.1.101",
    timeSynchronized: true,
    cameraConnection: "disconnected",
    rtspState: "IDLE",
    rtmpState: "IDLE",
    currentSessionId: null,
    reconnectCount: 3,
    lastError: "CAMERA_AUTH_FAILED",
    firmwareVersion: "1.0.0",
    hardwareRevision: "P4-EVB-A"
  },
  {
    deviceId: "JNX-P4-000102",
    onlineStatus: "online",
    lastSeenAt: "2026-08-04T11:15:40Z",
    uptimeSeconds: 41200,
    resetReason: "power_on",
    freeHeap: 176500,
    minFreeHeap: 148200,
    largestFreeBlock: 88000,
    psramStatus: "ok, 5.8 MB free",
    wifiRssi: -61,
    ipAddress: "192.168.1.102",
    timeSynchronized: true,
    cameraConnection: "connected",
    rtspState: "STREAMING",
    rtmpState: "PUBLISHING",
    currentSessionId: "SES-20260804-0012",
    reconnectCount: 0,
    lastError: null,
    firmwareVersion: "1.0.0",
    hardwareRevision: "P4-EVB-A"
  }
];
