export interface RfRemoteRecord {
  remoteId: string;
  deviceId: string;
  name: string;
  pairedAt: string;
}

export interface AddRfRemoteInput {
  name?: string;
}

export interface RenameRfRemoteInput {
  name: string;
}

export class QrunlockRfRemoteError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "QrunlockRfRemoteError";
  }
}
