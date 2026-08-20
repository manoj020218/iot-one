import type { StreamerPlatform } from "../destinations/destination.types";

// Full state list from VPS prompt §11 — device only ever sees this
// through the trigger it received (§9 of firmware/API_CONTRACT.md: "the
// two state machines are related but not the same machine").
export type SessionStatus =
  | "REQUESTED"
  | "AUTHORIZED"
  | "DEVICE_CONNECTING"
  | "STREAMING"
  | "STOP_REQUESTED"
  | "STOPPING"
  | "STOPPED"
  | "FAILED"
  | "EXPIRED";

export type TriggerSource = "schedule" | "manual" | "recovery" | "api";

// Statuses where the device session lock (one active session per device)
// and the destination lock (one active session per destination) apply.
export const ACTIVE_SESSION_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "REQUESTED",
  "AUTHORIZED",
  "DEVICE_CONNECTING",
  "STREAMING",
  "STOP_REQUESTED",
  "STOPPING"
]);

export interface StreamerSessionSummary {
  sessionId: string;
  homeId: string;
  deviceId: string;
  cameraId: string;
  destinationId: string;
  platform: StreamerPlatform;
  status: SessionStatus;
  triggerSource: TriggerSource;
  videoMode: string | null;
  audioMode: string | null;
  connectionStatus: string | null;
  reconnectCount: number;
  currentBitrateKbps: number | null;
  startTime: string;
  plannedStopAt: string | null;
  stoppedAt: string | null;
  stopReason: string | null;
  errorCode: string | null;
}

export interface StartSessionInput {
  cameraId: string;
  destinationId: string;
  plannedStopAt?: string;
  triggerSource?: TriggerSource;
  requestId?: string;
}

export interface StopSessionInput {
  sessionId: string;
  reason?: string;
}

export class StreamerSessionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "StreamerSessionError";
  }
}
