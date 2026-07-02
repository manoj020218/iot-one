import type { CreatePidInput, ProductPidRecord } from "@jenix/device-schemas";
import { createAuditStamp } from "@jenix/shared";

import {
  pidAuditRepository,
  pidRepository,
  snapshotPidPersistenceState
} from "./pid.model";
import type {
  PidActorContext,
  PidAuditAction,
  PidAuditLogRecord,
  PidPatchPayload
} from "./pid.types";
import { PidModuleError } from "./pid.types";
import { parseCreatePidInput } from "./pid.validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePid(pid: string): string {
  return pid.trim().toUpperCase();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toCreatePidInput(record: ProductPidRecord): CreatePidInput {
  const {
    approvedAt: _approvedAt,
    approvedBy: _approvedBy,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    ...input
  } = record;

  return clone(input);
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isRecord(base) || !isRecord(patch)) {
    return clone(patch);
  }

  const result: Record<string, unknown> = { ...clone(base) };

  for (const [key, value] of Object.entries(patch)) {
    const existingValue = result[key];

    if (isRecord(existingValue) && isRecord(value)) {
      result[key] = deepMerge(existingValue, value);
      continue;
    }

    result[key] = clone(value);
  }

  return result;
}

function writeAuditLog(
  pid: string,
  action: PidAuditAction,
  actor: PidActorContext,
  summary: string,
  occurredAt: string
): Promise<void> {
  const stamp = createAuditStamp({
    actorId: actor.actorId,
    action,
    occurredAt: new Date(occurredAt)
  });
  const audit: PidAuditLogRecord = {
    auditId: `${action}-${pid}-${occurredAt}`,
    pid,
    action,
    actorId: stamp.actorId,
    occurredAt: stamp.occurredAt,
    summary
  };

  return pidAuditRepository.append(audit);
}

async function requirePid(pid: string): Promise<ProductPidRecord> {
  const record = await pidRepository.get(normalizePid(pid));

  if (!record) {
    throw new PidModuleError(404, `PID not found: ${normalizePid(pid)}`);
  }

  return record;
}

export function listPids(): Promise<ProductPidRecord[]> {
  return pidRepository.list();
}

export function getPid(pid: string): Promise<ProductPidRecord> {
  return requirePid(pid);
}

export async function getPublicPid(pid: string): Promise<CreatePidInput> {
  return toCreatePidInput(await requirePid(pid));
}

export async function createPid(
  input: CreatePidInput,
  actor: PidActorContext
): Promise<ProductPidRecord> {
  const normalizedPid = normalizePid(input.pid);

  if (await pidRepository.get(normalizedPid)) {
    throw new PidModuleError(409, `PID already exists: ${normalizedPid}`);
  }

  if (input.status === "production") {
    throw new PidModuleError(
      400,
      "New PID records cannot start in production. Use the approve route."
    );
  }

  const timestamp = new Date().toISOString();
  const record: ProductPidRecord = {
    ...clone(input),
    pid: normalizedPid,
    createdBy: actor.actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await pidRepository.save(record);
  await writeAuditLog(
    normalizedPid,
    "pid.created",
    actor,
    "PID created",
    timestamp
  );

  return record;
}

export async function updatePid(
  pid: string,
  patch: PidPatchPayload,
  actor: PidActorContext
): Promise<ProductPidRecord> {
  const existing = await requirePid(pid);

  if (existing.approvedAt || existing.status === "production") {
    throw new PidModuleError(
      409,
      `Approved production PID is immutable: ${existing.pid}`
    );
  }

  const mergedCandidate = deepMerge(toCreatePidInput(existing), patch);
  const parsed = parseCreatePidInput(mergedCandidate);

  if (!parsed.ok) {
    throw new PidModuleError(400, parsed.errors.join("; "));
  }

  if (normalizePid(parsed.data.pid) !== existing.pid) {
    throw new PidModuleError(400, "PID identity cannot be changed");
  }

  const timestamp = new Date().toISOString();
  const updated: ProductPidRecord = {
    ...existing,
    ...parsed.data,
    pid: existing.pid,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: timestamp
  };

  await pidRepository.save(updated);
  await writeAuditLog(existing.pid, "pid.updated", actor, "PID updated", timestamp);

  return updated;
}

export async function approvePid(
  pid: string,
  actor: PidActorContext
): Promise<ProductPidRecord> {
  const existing = await requirePid(pid);

  if (existing.approvedAt || existing.status === "production") {
    throw new PidModuleError(409, `PID is already approved: ${existing.pid}`);
  }

  if (!existing.firmware.stableVersion) {
    throw new PidModuleError(
      400,
      "PID requires firmware.stableVersion before approval"
    );
  }

  const timestamp = new Date().toISOString();
  const approved: ProductPidRecord = {
    ...existing,
    status: "production",
    approvedBy: actor.actorId,
    approvedAt: timestamp,
    updatedAt: timestamp
  };

  await pidRepository.save(approved);
  await writeAuditLog(existing.pid, "pid.approved", actor, "PID approved", timestamp);

  return approved;
}

export async function archivePid(
  pid: string,
  actor: PidActorContext
): Promise<ProductPidRecord> {
  const existing = await requirePid(pid);

  if (existing.status === "discontinued") {
    throw new PidModuleError(409, `PID is already archived: ${existing.pid}`);
  }

  const timestamp = new Date().toISOString();
  const archived: ProductPidRecord = {
    ...existing,
    status: "discontinued",
    updatedAt: timestamp
  };

  await pidRepository.save(archived);
  await writeAuditLog(existing.pid, "pid.archived", actor, "PID archived", timestamp);

  return archived;
}

export const pidTesting = {
  reset() {
    return Promise.all([pidRepository.reset(), pidAuditRepository.reset()]).then(
      () => undefined
    );
  },
  snapshot() {
    return snapshotPidPersistenceState();
  }
};
