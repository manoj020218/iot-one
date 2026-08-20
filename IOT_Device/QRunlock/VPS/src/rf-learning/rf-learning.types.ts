export type RfLearnStatus = "idle" | "learning" | "learned" | "cancelled" | "timeout";

export interface RfLearnStateRecord {
  deviceId: string;
  status: RfLearnStatus;
  startedAt: string | null;
  updatedAt: string;
}

export class QrunlockRfLearnError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "QrunlockRfLearnError";
  }
}
