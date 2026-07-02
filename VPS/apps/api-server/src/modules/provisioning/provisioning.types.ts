import type {
  ProvisioningIntent,
  ProvisioningMethod,
  ProvisioningStatus
} from "@jenix/shared";

export interface RegisterProvisioningIntentPayload {
  userId: string;
  homeId: string;
  method: ProvisioningMethod;
  pid?: string;
}

export interface CompleteProvisioningPayload {
  deviceId: string;
  pid?: string;
  status?: ProvisioningStatus;
}

export class ProvisioningModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ProvisioningModuleError";
  }
}

export type ProvisioningIntentRecord = ProvisioningIntent;
