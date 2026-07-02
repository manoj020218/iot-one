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

export interface PublicApiStateResponse extends PublicDeviceState {
  packageId: string;
}

export interface PublicApiCommandResponse extends PublicDeviceCommandResult {
  packageId: string;
}

export type ApiKeyCreateResponse = ApiKeyCreateResult;
