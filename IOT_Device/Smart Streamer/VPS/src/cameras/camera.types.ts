// PWA-facing shape — matches VPS/API_CONTRACT.md §2. rtspPassword is
// intentionally absent here: write-only, never returned by any GET.
export interface StreamerCameraSummary {
  cameraId: string;
  homeId: string;
  friendlyName: string;
  rtspHost: string;
  rtspPort: number;
  rtspPath: string;
  hasCredentials: boolean;
  mainStreamUrl: string | null;
  subStreamUrl: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  rotation: number;
  transport: "tcp" | "udp";
  connectionTimeoutSeconds: number;
  assignedDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Internal record — the one place rtspPassword actually lives.
// Real deployments must encrypt this at rest (VPS prompt §9, AES-GCM);
// this in-memory dev store deliberately does not pretend to, and says so.
export interface StreamerCameraRecord extends StreamerCameraSummary {
  rtspUsername: string | null;
  rtspPassword: string | null;
}

export interface CreateCameraInput {
  friendlyName: string;
  rtspHost: string;
  rtspPort: number;
  rtspPath: string;
  rtspUsername?: string;
  rtspPassword?: string;
  mainStreamUrl?: string;
  subStreamUrl?: string;
  videoCodec?: string;
  audioCodec?: string;
  rotation?: number;
  transport?: "tcp" | "udp";
  connectionTimeoutSeconds?: number;
}

export type UpdateCameraInput = Partial<CreateCameraInput>;

export type CameraTestStepStatus = "pending" | "in_progress" | "passed" | "failed";

export interface CameraTestStep {
  step:
    | "reachable"
    | "rtsp_auth"
    | "video_codec"
    | "audio_codec"
    | "keyframe"
    | "passthrough_compatible";
  status: CameraTestStepStatus;
}

export interface CameraTestSession {
  testId: string;
  cameraId: string;
  deviceId: string;
  status: "in_progress" | "passed" | "failed" | "timeout";
  steps: CameraTestStep[];
  startedAt: string;
  updatedAt: string;
}

export class StreamerCameraError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "StreamerCameraError";
  }
}
