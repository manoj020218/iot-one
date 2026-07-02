import type {
  HomeAccessRole,
  MatterBridgeState,
  MatterCommissioningState
} from "@jenix/shared";

export interface MatterRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface MatterRuntimeRecord {
  deviceId: string;
  commissioningState?: MatterCommissioningState;
  bridgeState?: MatterBridgeState;
  lastCommissioningAttemptAt?: string;
  lastBridgeSyncAt?: string;
}

export class MatterModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "MatterModuleError";
  }
}
