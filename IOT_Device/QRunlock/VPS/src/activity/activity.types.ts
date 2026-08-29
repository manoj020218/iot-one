// No "auto_lock" type: the 10s red->green relock the UI shows after an
// unlock is a client-side display timer only (see the PWA's LockHero
// component) — the backend never learns the relay physically reset, so it
// has nothing true to record for that moment. Only log events this
// package actually dispatched or was told about.
//
// "rf_learn_success" IS backed by a real firmware confirmation (source
// "device", not "app"/"system") — CloudBridgeService::PublishRfLearnResult
// publishes it on the device's own .../events MQTT topic only when
// RfService actually observes the paired remote's VT line go HIGH, wired
// in via applyRfLearnResult() (rf-learning.service.ts). Previously this
// package could only ever guess "timeout" from elapsed time, per that
// function's own doc comment — this is the real ack it was waiting on.
export type QrunlockActivityType =
  | "unlock"
  | "rf_learn_start"
  | "rf_learn_cancel"
  | "rf_learn_timeout"
  | "rf_learn_success";

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
