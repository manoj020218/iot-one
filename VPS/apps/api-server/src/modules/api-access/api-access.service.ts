import {
  canManageHomeMembership,
  isRestrictedSceneCommand,
  type ApiKeyCreateResult,
  type ApiKeyRecord,
  type ApiPackageRecord,
  type PublicDeviceCommandResult,
  type PublicDeviceState,
  type SceneActionCommand
} from "@jenix/shared";

import { DeviceModuleError } from "../devices/device.types";
import { getDevice, listDevices } from "../devices/device.service";
import { getPid } from "../pid/pid.service";
import { apiAccessRepository } from "./api-access.model";
import type {
  ApiKeyRequestContext,
  ApiPackageActorContext,
  CreateApiKeyInput,
  CreateApiPackageInput,
  PublicApiAuthorizedContext,
  PublicApiModuleState,
  PublicCommandPayload
} from "./api-access.types";
import {
  ApiAccessModuleError,
  type PublicApiCommandResponse,
  type PublicApiStateResponse
} from "./api-access.types";

function normalizePackageId(packageId: string) {
  return packageId.trim().toUpperCase();
}

function normalizeScope(scope: string) {
  return scope.trim().toLowerCase();
}

function uniqueScopes(scopes: string[]) {
  return Array.from(new Set(scopes.map(normalizeScope)));
}

function normalizePid(pid: string) {
  return pid.trim().toUpperCase();
}

function readContextHome(context: ApiKeyRequestContext) {
  if (!context.homeId || !context.userId || !context.homeRole) {
    throw new ApiAccessModuleError(400, "HOME context is required");
  }

  return {
    homeId: context.homeId,
    userId: context.userId,
    homeRole: context.homeRole
  };
}

function requireHomeManager(context: ApiKeyRequestContext) {
  const resolved = readContextHome(context);

  if (!canManageHomeMembership(resolved.homeRole)) {
    throw new ApiAccessModuleError(403, "API key management requires owner/admin access");
  }

  return resolved;
}

function requirePackage(packageId: string): ApiPackageRecord {
  const record = apiAccessRepository.getPackage(normalizePackageId(packageId));

  if (!record) {
    throw new ApiAccessModuleError(
      404,
      `API package not found: ${normalizePackageId(packageId)}`
    );
  }

  return record;
}

function requireKey(keyId: string): ApiKeyRecord {
  const record = apiAccessRepository.getKey(keyId);

  if (!record) {
    throw new ApiAccessModuleError(404, `API key not found: ${keyId}`);
  }

  return record;
}

function generateSecret(keyId: string) {
  return `jnx_live_${keyId.toLowerCase()}_${Math.random().toString(36).slice(2, 12)}`;
}

function maskSecret(secret: string) {
  return `${secret.slice(0, 10)}...${secret.slice(-4)}`;
}

function toSceneActionCommand(command: string): SceneActionCommand | null {
  return command === "refresh" ||
    command === "sync" ||
    command === "set_relay" ||
    command === "notify" ||
    command === "factory_reset" ||
    command === "ota_force" ||
    command === "matter_commission" ||
    command === "matter_bridge_sync"
    ? command
    : null;
}

function assertPidApiScopes(pid: string, scopes: string[]) {
  const pidRecord = getPid(pid);

  if (!pidRecord.api.enabled) {
    throw new ApiAccessModuleError(409, `PID API access is disabled for ${pidRecord.pid}`);
  }

  const allowedScopes = new Set(pidRecord.api.allowedScopes.map(normalizeScope));
  const invalidScope = scopes.find((scope) => !allowedScopes.has(scope));

  if (invalidScope) {
    throw new ApiAccessModuleError(
      409,
      `Scope ${invalidScope} is not allowed for PID ${pidRecord.pid}`
    );
  }

  return pidRecord;
}

function translateDeviceError(error: unknown): never {
  if (error instanceof DeviceModuleError) {
    throw new ApiAccessModuleError(error.statusCode, error.message);
  }

  throw error;
}

function authorizePublicDeviceScope(
  apiSecret: string,
  deviceId: string,
  requiredScope: string
): PublicApiAuthorizedContext & { deviceState: PublicDeviceState } {
  const normalizedSecret = apiSecret.trim();

  if (!normalizedSecret) {
    throw new ApiAccessModuleError(401, "API key is required");
  }

  const keyRecord = apiAccessRepository.findKeyBySecret(normalizedSecret);

  if (!keyRecord || keyRecord.status !== "active") {
    throw new ApiAccessModuleError(401, "API key is invalid");
  }

  if (keyRecord.expiresAt && Date.parse(keyRecord.expiresAt) <= Date.now()) {
    throw new ApiAccessModuleError(401, "API key has expired");
  }

  const packageRecord = requirePackage(keyRecord.packageId);

  if (packageRecord.status !== "active") {
    throw new ApiAccessModuleError(403, "API package is not active");
  }

  const normalizedRequiredScope = normalizeScope(requiredScope);
  const packageScopes = new Set(packageRecord.scopes.map(normalizeScope));
  const keyScopes = new Set(keyRecord.scopes.map(normalizeScope));
  const pidRecord = assertPidApiScopes(packageRecord.pid, packageRecord.scopes);

  if (!packageScopes.has(normalizedRequiredScope) || !keyScopes.has(normalizedRequiredScope)) {
    throw new ApiAccessModuleError(
      403,
      `API key does not grant the required scope: ${normalizedRequiredScope}`
    );
  }

  if (
    !pidRecord.api.allowedScopes.map(normalizeScope).includes(normalizedRequiredScope)
  ) {
    throw new ApiAccessModuleError(
      403,
      `PID ${packageRecord.pid} does not expose scope ${normalizedRequiredScope}`
    );
  }

  try {
    const device = getDevice(deviceId, {});

    if (device.homeId !== keyRecord.homeId) {
      throw new ApiAccessModuleError(403, "API key cannot access devices outside its HOME");
    }

    if (device.pid !== packageRecord.pid) {
      throw new ApiAccessModuleError(
        403,
        `API package PID ${packageRecord.pid} does not match device PID ${device.pid}`
      );
    }

    return {
      packageRecord,
      keyRecord,
      deviceState: {
        deviceId: device.deviceId,
        displayName: device.displayName,
        pid: device.pid,
        ...(device.firmwareVersion ? { firmwareVersion: device.firmwareVersion } : {}),
        ...(device.hardwareRevision ? { hardwareRevision: device.hardwareRevision } : {}),
        mqttStatus: device.mqttStatus,
        cloudStatus: device.cloudStatus,
        ...(device.localStatus ? { localStatus: device.localStatus } : {}),
        ...(device.lastSeenAt ? { lastSeenAt: device.lastSeenAt } : {})
      }
    };
  } catch (error) {
    translateDeviceError(error);
  }
}

export function listApiPackages(): ApiPackageRecord[] {
  return apiAccessRepository.listPackages().sort((left, right) =>
    left.packageId.localeCompare(right.packageId)
  );
}

export function getApiPackage(packageId: string): ApiPackageRecord {
  return requirePackage(packageId);
}

export function createApiPackage(
  input: CreateApiPackageInput,
  actor: ApiPackageActorContext
): ApiPackageRecord {
  const packageId = normalizePackageId(input.packageId);

  if (apiAccessRepository.getPackage(packageId)) {
    throw new ApiAccessModuleError(409, `API package already exists: ${packageId}`);
  }

  const pidRecord = assertPidApiScopes(input.pid, uniqueScopes(input.scopes));
  const timestamp = new Date().toISOString();
  const record: ApiPackageRecord = {
    packageId,
    pid: normalizePid(input.pid),
    name: input.name.trim(),
    status: input.status ?? "draft",
    scopes: uniqueScopes(input.scopes),
    createdBy: actor.actorId,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(input.docsUrl ? { docsUrl: input.docsUrl.trim() } : {}),
    ...(input.rateLimitPerMinute
      ? { rateLimitPerMinute: input.rateLimitPerMinute }
      : {})
  };

  if (record.pid !== pidRecord.pid) {
    throw new ApiAccessModuleError(409, `PID mismatch for API package ${packageId}`);
  }

  return apiAccessRepository.savePackage(record);
}

export function listApiKeys(context: ApiKeyRequestContext): ApiKeyRecord[] {
  const { homeId } = requireHomeManager(context);

  return apiAccessRepository
    .listKeys()
    .filter((record) => record.homeId === homeId)
    .sort((left, right) => left.keyId.localeCompare(right.keyId));
}

export function createApiKey(
  input: CreateApiKeyInput,
  context: ApiKeyRequestContext
): ApiKeyCreateResult {
  const { homeId, userId } = requireHomeManager(context);
  const packageRecord = requirePackage(input.packageId);

  if (packageRecord.status !== "active") {
    throw new ApiAccessModuleError(409, "API package must be active before keys can be issued");
  }

  const devices = listDevices({ homeId }).filter((device) => device.pid === packageRecord.pid);

  if (!devices.length) {
    throw new ApiAccessModuleError(
      409,
      `HOME ${homeId} does not contain a device for PID ${packageRecord.pid}`
    );
  }

  const scopes = uniqueScopes(input.scopes ?? packageRecord.scopes);
  const packageScopes = new Set(packageRecord.scopes.map(normalizeScope));
  const invalidScope = scopes.find((scope) => !packageScopes.has(scope));

  if (invalidScope) {
    throw new ApiAccessModuleError(
      409,
      `API package ${packageRecord.packageId} does not grant scope ${invalidScope}`
    );
  }

  assertPidApiScopes(packageRecord.pid, scopes);

  const timestamp = new Date().toISOString();
  const keyId = `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const secret = generateSecret(keyId);
  const record: ApiKeyRecord = {
    keyId,
    packageId: packageRecord.packageId,
    pid: packageRecord.pid,
    homeId,
    label: input.label.trim(),
    scopes,
    status: "active",
    createdByUserId: userId,
    maskedKey: maskSecret(secret),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  };

  apiAccessRepository.saveKey(record);
  apiAccessRepository.storeKeySecret({
    ...record,
    secret
  });

  return {
    ...record,
    secret
  };
}

export function revokeApiKey(
  keyId: string,
  context: ApiKeyRequestContext
): ApiKeyRecord {
  const { homeId } = requireHomeManager(context);
  const existing = requireKey(keyId);

  if (existing.homeId !== homeId) {
    throw new ApiAccessModuleError(403, "API key does not belong to the current HOME");
  }

  if (existing.status === "revoked") {
    return existing;
  }

  const updated: ApiKeyRecord = {
    ...existing,
    status: "revoked",
    revokedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return apiAccessRepository.saveKey(updated);
}

export function getPublicDeviceState(
  deviceId: string,
  apiSecret: string
): PublicApiStateResponse {
  const authorized = authorizePublicDeviceScope(apiSecret, deviceId, "devices:read");

  return {
    ...authorized.deviceState,
    packageId: authorized.packageRecord.packageId
  };
}

export function executePublicDeviceCommand(
  deviceId: string,
  apiSecret: string,
  payload: PublicCommandPayload
): PublicApiCommandResponse {
  const sceneCommand = toSceneActionCommand(payload.command);
  const requiredScope = sceneCommand && isRestrictedSceneCommand(sceneCommand)
    ? "devices:admin"
    : "devices:write";
  const authorized = authorizePublicDeviceScope(apiSecret, deviceId, requiredScope);

  const result: PublicDeviceCommandResult = {
    deviceId,
    accepted: true,
    command: payload.command,
    occurredAt: new Date().toISOString()
  };

  return {
    ...result,
    packageId: authorized.packageRecord.packageId
  };
}

export const apiAccessTesting = {
  reset() {
    apiAccessRepository.reset();
  },
  snapshot(): PublicApiModuleState {
    return {
      packages: listApiPackages(),
      keys: apiAccessRepository.listKeys()
    };
  }
};
