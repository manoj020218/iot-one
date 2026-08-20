/**
 * Shaped like GET /api/v1/streamer/cameras in VPS/API_CONTRACT.md §2.
 * Note what's deliberately absent: no password field at all, anywhere —
 * that contract is write-only server-side, so the demo data doesn't even
 * pretend to have one to swap out later.
 */
export interface StreamerCameraSummary {
  cameraId: string;
  friendlyName: string;
  rtspHost: string;
  rtspPort: number;
  rtspPath: string;
  videoCodec: string;
  audioCodec: string;
  rotation: number;
  transport: "tcp" | "udp";
  assignedDeviceId: string | null;
}

export const DEMO_STREAMER_CAMERAS: StreamerCameraSummary[] = [
  {
    cameraId: "CAM-0001",
    friendlyName: "Front Gate",
    rtspHost: "192.168.1.40",
    rtspPort: 554,
    rtspPath: "/stream1",
    videoCodec: "H.264",
    audioCodec: "AAC",
    rotation: 0,
    transport: "tcp",
    assignedDeviceId: "JNX-P4-000101"
  },
  {
    cameraId: "CAM-0002",
    friendlyName: "Prayer Hall",
    rtspHost: "192.168.1.41",
    rtspPort: 554,
    rtspPath: "/stream1",
    videoCodec: "H.264",
    audioCodec: "AAC",
    rotation: 0,
    transport: "tcp",
    assignedDeviceId: "JNX-P4-000102"
  }
];
