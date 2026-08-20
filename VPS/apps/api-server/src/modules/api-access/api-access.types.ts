import type {
  ApiKeyCreateResult,
  ApiKeyRecord,
  ApiPackageRecord,
  HomeAccessRole,
  PublicDeviceCommandResult,
  PublicDeviceState
} from "@jenix/shared";

export interface ApiPackageActorContext {
  actorId: string;
  role: "JENIX_DEVELOPER" | "JENIX_SUPER_ADMIN";
}

export interface ApiKeyRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface CreateApiPackageInput {
  packageId: string;
  pid: string;
  name: string;
  status?: ApiPackageRecord["status"];
  scopes: string[];
  docsUrl?: string;
  rateLimitPerMinute?: number;
}

export interface CreateApiKeyInput {
  packageId: string;
  label: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface PublicCommandPayload {
  command: string;
  payload?: Record<string, unknown>;
}

/**
 * Vendor-authenticated (x-api-key, no Jenix user session) — a QRunlock
 * host, for example, never logs into Jenix One. The device is registered
 * into the API key's own homeId (the "vendor pool HOME" — see
 * RELAY_INTEGRATION_PLAN.md), which is what confines the key's blast
 * radius to that vendor's own devices via the existing
 * device.homeId === keyRecord.homeId check every other public route uses.
 */
export interface RegisterVendorDeviceInput {
  deviceId: string;
  displayName?: string;
  hardwareRevision?: string;
  firmwareVersion?: string;
}

export interface VendorConfigPatchPayload {
  patch: Record<string, unknown>;
}

export interface PublicApiModuleState {
  packages: ApiPackageRecord[];
  keys: ApiKeyRecord[];
}

export interface PublicApiAuthorizedContext {
  packageRecord: ApiPackageRecord;
  keyRecord: ApiKeyRecord;
}

export class ApiAccessModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiAccessModuleError";
  }
}

export type ParsedApiPackagePayload = CreateApiPackageInput;
export type ParsedApiKeyPayload = CreateApiKeyInput;
export type ParsedPublicCommandPayload = PublicCommandPayload;
export type ParsedRegisterVendorDeviceInput = RegisterVendorDeviceInput;
export type ParsedVendorConfigPatchPayload = VendorConfigPatchPayload;

export interface PublicApiStateResponse extends PublicDeviceState {
  packageId: string;
}

export interface PublicApiCommandResponse extends PublicDeviceCommandResult {
  packageId: string;
}

export interface VendorDeviceListResponse {
  packageId: string;
  devices: PublicDeviceState[];
}

export type ApiKeyCreateResponse = ApiKeyCreateResult;
