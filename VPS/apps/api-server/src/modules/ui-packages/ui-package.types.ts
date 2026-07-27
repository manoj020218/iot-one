import type {
  AddUiPackageVersionInput,
  CreateUiPackageInput,
  UiPackageRecord
} from "@jenix/shared";

export interface UiPackageActorContext {
  actorId: string;
  role: "JENIX_DEVELOPER" | "JENIX_SUPER_ADMIN";
}

export type UiPackageAuditAction =
  | "ui-package.registered"
  | "ui-package.version-added"
  | "ui-package.published"
  | "ui-package.deprecated"
  | "ui-package.rolled-back";

export interface UiPackageAuditLogRecord {
  auditId: string;
  packageId: string;
  action: UiPackageAuditAction;
  actorId: string;
  occurredAt: string;
  summary: string;
}

export interface UiPackageModuleState {
  packages: UiPackageRecord[];
  auditLogs: UiPackageAuditLogRecord[];
}

export class UiPackageModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "UiPackageModuleError";
  }
}

export interface UiPackageValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface UiPackageValidationFailure {
  ok: false;
  errors: string[];
}

export type UiPackageValidationResult<T> =
  | UiPackageValidationSuccess<T>
  | UiPackageValidationFailure;

export type ParsedCreateUiPackageInput = CreateUiPackageInput;
export type ParsedAddUiPackageVersionInput = AddUiPackageVersionInput;
