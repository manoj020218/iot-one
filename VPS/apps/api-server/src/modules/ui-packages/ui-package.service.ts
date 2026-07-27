import type {
  AddUiPackageVersionInput,
  CreateUiPackageInput,
  HomeUiBootstrapPackageRecord,
  UiPackageRecord,
  UiPackageVersionRecord
} from "@jenix/shared";
import { createAuditStamp } from "@jenix/shared";

import { getPid } from "../pid/pid.service";
import { PidModuleError } from "../pid/pid.types";

import {
  snapshotUiPackagePersistenceState,
  uiPackageAuditRepository,
  uiPackageRepository
} from "./ui-package.model";
import type {
  UiPackageActorContext,
  UiPackageAuditAction,
  UiPackageAuditLogRecord
} from "./ui-package.types";
import { UiPackageModuleError } from "./ui-package.types";
import {
  parseAddUiPackageVersionInput,
  parseCreateUiPackageInput
} from "./ui-package.validation";

function writeAuditLog(
  packageId: string,
  action: UiPackageAuditAction,
  actor: UiPackageActorContext,
  summary: string,
  occurredAt: string
): Promise<void> {
  const stamp = createAuditStamp({
    actorId: actor.actorId,
    action,
    occurredAt: new Date(occurredAt)
  });
  const audit: UiPackageAuditLogRecord = {
    auditId: `${action}-${packageId}-${occurredAt}`,
    packageId,
    action,
    actorId: stamp.actorId,
    occurredAt: stamp.occurredAt,
    summary
  };

  return uiPackageAuditRepository.append(audit);
}

async function requirePackage(packageId: string): Promise<UiPackageRecord> {
  const record = await uiPackageRepository.get(packageId);

  if (!record) {
    throw new UiPackageModuleError(404, `UI package not found: ${packageId}`);
  }

  return record;
}

async function requirePidExists(pid: string): Promise<void> {
  try {
    await getPid(pid);
  } catch (error) {
    if (error instanceof PidModuleError) {
      throw new UiPackageModuleError(error.statusCode, error.message);
    }

    throw error;
  }
}

function requireVersion(
  record: UiPackageRecord,
  version: string
): UiPackageVersionRecord {
  const found = record.versions.find((entry) => entry.version === version);

  if (!found) {
    throw new UiPackageModuleError(
      404,
      `Version not found: ${record.packageId}@${version}`
    );
  }

  return found;
}

export function listUiPackages(): Promise<UiPackageRecord[]> {
  return uiPackageRepository.list();
}

export function getUiPackage(packageId: string): Promise<UiPackageRecord> {
  return requirePackage(packageId);
}

export function listUiPackageAuditLog(
  packageId: string
): Promise<UiPackageAuditLogRecord[]> {
  return uiPackageAuditRepository.list(packageId);
}

export async function registerUiPackage(
  input: CreateUiPackageInput,
  actor: UiPackageActorContext
): Promise<UiPackageRecord> {
  const parsed = parseCreateUiPackageInput(input);

  if (!parsed.ok) {
    throw new UiPackageModuleError(400, parsed.errors.join("; "));
  }

  const data = parsed.data;

  if (await uiPackageRepository.get(data.packageId)) {
    throw new UiPackageModuleError(409, `UI package already exists: ${data.packageId}`);
  }

  // A package binds to a real product — PID-first, same as the rest of the platform.
  await requirePidExists(data.pid);

  const timestamp = new Date().toISOString();
  const version: UiPackageVersionRecord = {
    version: data.version,
    manifestPath: data.manifestPath,
    entryPath: data.entryPath,
    exportName: data.exportName,
    status: data.publishImmediately ? "published" : "draft",
    createdAt: timestamp,
    createdBy: actor.actorId,
    ...(data.integrity ? { integrity: data.integrity } : {}),
    ...(data.publishImmediately
      ? { publishedAt: timestamp, publishedBy: actor.actorId }
      : {})
  };

  const record: UiPackageRecord = {
    packageId: data.packageId,
    pid: data.pid,
    displayName: data.displayName,
    versions: [version],
    createdAt: timestamp,
    createdBy: actor.actorId,
    updatedAt: timestamp
  };

  await uiPackageRepository.save(record);
  await writeAuditLog(
    record.packageId,
    "ui-package.registered",
    actor,
    `Package registered at ${data.version}`,
    timestamp
  );

  return record;
}

export async function addUiPackageVersion(
  packageId: string,
  input: AddUiPackageVersionInput,
  actor: UiPackageActorContext
): Promise<UiPackageRecord> {
  const existing = await requirePackage(packageId);
  const parsed = parseAddUiPackageVersionInput(input);

  if (!parsed.ok) {
    throw new UiPackageModuleError(400, parsed.errors.join("; "));
  }

  const data = parsed.data;

  if (existing.versions.some((entry) => entry.version === data.version)) {
    throw new UiPackageModuleError(
      409,
      `Version already exists: ${packageId}@${data.version}`
    );
  }

  const timestamp = new Date().toISOString();
  const newVersion: UiPackageVersionRecord = {
    version: data.version,
    manifestPath: data.manifestPath,
    entryPath: data.entryPath,
    exportName: data.exportName,
    status: data.publishImmediately ? "published" : "draft",
    createdAt: timestamp,
    createdBy: actor.actorId,
    ...(data.integrity ? { integrity: data.integrity } : {}),
    ...(data.publishImmediately
      ? { publishedAt: timestamp, publishedBy: actor.actorId }
      : {})
  };

  const versions = data.publishImmediately
    ? existing.versions.map((entry) =>
        entry.status === "published"
          ? { ...entry, status: "deprecated" as const, deprecatedAt: timestamp }
          : entry
      )
    : existing.versions;

  const updated: UiPackageRecord = {
    ...existing,
    versions: [...versions, newVersion],
    updatedAt: timestamp
  };

  await uiPackageRepository.save(updated);
  await writeAuditLog(
    packageId,
    "ui-package.version-added",
    actor,
    `Version ${data.version} added`,
    timestamp
  );

  return updated;
}

export async function publishUiPackageVersion(
  packageId: string,
  version: string,
  actor: UiPackageActorContext
): Promise<UiPackageRecord> {
  const existing = await requirePackage(packageId);
  requireVersion(existing, version);

  const timestamp = new Date().toISOString();
  const versions = existing.versions.map((entry) => {
    if (entry.version === version) {
      return {
        ...entry,
        status: "published" as const,
        publishedAt: timestamp,
        publishedBy: actor.actorId
      };
    }

    if (entry.status === "published") {
      return { ...entry, status: "deprecated" as const, deprecatedAt: timestamp };
    }

    return entry;
  });

  const updated: UiPackageRecord = { ...existing, versions, updatedAt: timestamp };
  await uiPackageRepository.save(updated);
  await writeAuditLog(
    packageId,
    "ui-package.published",
    actor,
    `Version ${version} published`,
    timestamp
  );

  return updated;
}

export async function deprecateUiPackageVersion(
  packageId: string,
  version: string,
  actor: UiPackageActorContext
): Promise<UiPackageRecord> {
  const existing = await requirePackage(packageId);
  const target = requireVersion(existing, version);

  if (target.status === "deprecated") {
    throw new UiPackageModuleError(
      409,
      `Version already deprecated: ${packageId}@${version}`
    );
  }

  const timestamp = new Date().toISOString();
  const versions = existing.versions.map((entry) =>
    entry.version === version
      ? { ...entry, status: "deprecated" as const, deprecatedAt: timestamp }
      : entry
  );

  const updated: UiPackageRecord = { ...existing, versions, updatedAt: timestamp };
  await uiPackageRepository.save(updated);
  await writeAuditLog(
    packageId,
    "ui-package.deprecated",
    actor,
    `Version ${version} deprecated`,
    timestamp
  );

  return updated;
}

export async function rollbackUiPackage(
  packageId: string,
  targetVersion: string,
  actor: UiPackageActorContext
): Promise<UiPackageRecord> {
  const existing = await requirePackage(packageId);
  const target = requireVersion(existing, targetVersion);

  if (target.status !== "deprecated") {
    throw new UiPackageModuleError(
      409,
      `Only a deprecated version can be rolled back to: ${packageId}@${targetVersion}`
    );
  }

  const timestamp = new Date().toISOString();
  const versions = existing.versions.map((entry) => {
    if (entry.version === targetVersion) {
      const { deprecatedAt: _deprecatedAt, ...rest } = entry;
      return {
        ...rest,
        status: "published" as const,
        publishedAt: timestamp,
        publishedBy: actor.actorId
      };
    }

    if (entry.status === "published") {
      return { ...entry, status: "deprecated" as const, deprecatedAt: timestamp };
    }

    return entry;
  });

  const updated: UiPackageRecord = { ...existing, versions, updatedAt: timestamp };
  await uiPackageRepository.save(updated);
  await writeAuditLog(
    packageId,
    "ui-package.rolled-back",
    actor,
    `Rolled back to ${targetVersion}`,
    timestamp
  );

  return updated;
}

/**
 * Registry-backed replacement for the old hardcoded catalog Map
 * (see DEVICE_PACKAGE_RUNTIME.md). Resolves the exact packageId+version a PID
 * binding points to, for HOME UI bootstrap. Draft versions never resolve —
 * only published or deprecated (still-servable, in case a device is mid
 * rollback) versions are returned.
 */
export async function resolveUiPackageArtifact(
  packageId: string,
  version: string
): Promise<HomeUiBootstrapPackageRecord | undefined> {
  const record = await uiPackageRepository.get(packageId);

  if (!record) {
    return undefined;
  }

  const match = record.versions.find(
    (entry) => entry.version === version && entry.status !== "draft"
  );

  if (!match) {
    return undefined;
  }

  return {
    packageId: record.packageId,
    version: match.version,
    manifestPath: match.manifestPath,
    entryPath: match.entryPath,
    exportName: match.exportName,
    ...(match.integrity ? { integrity: match.integrity } : {})
  };
}

export const uiPackageTesting = {
  reset() {
    return Promise.all([
      uiPackageRepository.reset(),
      uiPackageAuditRepository.reset()
    ]).then(() => undefined);
  },
  snapshot() {
    return snapshotUiPackagePersistenceState();
  }
};
