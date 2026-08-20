export interface UnlockInput {
  reason?: string;
  requestId?: string;
}

export interface UnlockResult {
  deviceId: string;
  status: "requested";
  dispatchedAt: string;
  cooldownMs: number;
}

export interface LockStateRecord {
  deviceId: string;
  lastDispatchedAt: string;
  lastReason: string | null;
}

export class QrunlockLockError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "QrunlockLockError";
  }
}
