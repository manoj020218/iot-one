// No "auto_lock" type: the 10s red->green relock the UI shows after an
// unlock is a client-side display timer only (see the PWA's LockHero
// component) — the backend never learns the relay physically reset, so it
// has nothing true to record for that moment. Only log events this
// package actually dispatched or was told about.
export type QrunlockActivityType = "unlock" | "rf_learn_start" | "rf_learn_cancel" | "rf_learn_timeout";

export interface QrunlockActivityEvent {
  eventId: string;
  deviceId: string;
  type: QrunlockActivityType;
  source: string;
  occurredAt: string;
  detail?: string;
}

export class QrunlockActivityError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "QrunlockActivityError";
  }
}
