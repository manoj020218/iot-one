export type NurseCallStatus = "active" | "attended";

export interface NurseCallRemoteRecord {
  remoteId: string;
  deviceId: string;
  name: string;
  remoteType: number;
  wardLabel?: string;
  roomLabel?: string;
  bedLabel?: string;
  learnedAt: string;
  updatedAt: string;
}

export interface NurseCallRecord {
  callId: string;
  deviceId: string;
  remoteId?: string;
  remoteName?: string;
  bedLabel?: string;
  status: NurseCallStatus;
  repeatCount: number;
  raisedAt: string;
  attendedAt?: string;
  attendedBy?: string;
}

export interface NurseCallReceiverModuleState {
  remotes: NurseCallRemoteRecord[];
  calls: NurseCallRecord[];
}

export class NurseCallReceiverModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "NurseCallReceiverModuleError";
  }
}

export interface SaveRemoteInput {
  name: string;
  remoteType: number;
  wardLabel?: string;
  roomLabel?: string;
  bedLabel?: string;
}

export interface RaiseCallInput {
  remoteId?: string;
  remoteName?: string;
  bedLabel?: string;
  occurredAt: string;
}

export type NurseCallDeviceCommand =
  | "refresh"
  | "restart"
  | "start_learning"
  | "attend_call"
  | "factory_reset";
