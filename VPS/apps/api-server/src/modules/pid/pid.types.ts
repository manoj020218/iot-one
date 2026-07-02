import type { CreatePidInput, ProductPidRecord } from "@jenix/device-schemas";

export type PidAuditAction =
  | "pid.created"
  | "pid.updated"
  | "pid.approved"
  | "pid.archived";

export interface PidActorContext {
  actorId: string;
  role: "JENIX_DEVELOPER" | "JENIX_SUPER_ADMIN";
}

export interface PidAuditLogRecord {
  auditId: string;
  pid: string;
  action: PidAuditAction;
  actorId: string;
  occurredAt: string;
  summary: string;
}

export interface PidModuleState {
  pids: ProductPidRecord[];
  auditLogs: PidAuditLogRecord[];
}

export class PidModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "PidModuleError";
  }
}

export interface CreatePidResult {
  data: ProductPidRecord;
}

export interface ListPidResult {
  data: ProductPidRecord[];
}

export interface PidValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface PidValidationFailure {
  ok: false;
  errors: string[];
}

export type PidValidationResult<T> =
  | PidValidationSuccess<T>
  | PidValidationFailure;

export type PidPatchPayload = Record<string, unknown>;

export interface PidCreateEnvelope {
  data: CreatePidInput;
}
