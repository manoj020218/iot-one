import type { RfLearnStatus } from "../rf-learning/rf-learning.types";

/**
 * PWA-facing shape — matches VPS/API_CONTRACT.md §1 exactly.
 */
export interface QrunlockDeviceSummary {
  deviceId: string;
  friendlyName: string;
  onlineStatus: "online" | "offline";
  relayState: "idle" | "pulsing";
  lastUnlockAt: string | null;
  lastUnlockReason: string | null;
  rfLearnStatus: RfLearnStatus;
  relayPulseMs: number;
  relayCooldownMs: number;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
}

export class QrunlockDeviceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "QrunlockDeviceError";
  }
}
