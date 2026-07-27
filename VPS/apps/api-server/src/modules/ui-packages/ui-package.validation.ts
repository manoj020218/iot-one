import type { AddUiPackageVersionInput, CreateUiPackageInput } from "@jenix/shared";

import type { UiPackageValidationResult } from "./ui-package.types";

const packageIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[],
  required = true
): string | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    if (required) {
      errors.push(`${label} is required`);
    }
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be a non-empty string`);
    return undefined;
  }

  return value.trim();
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[]
): boolean | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    errors.push(`${label} must be a boolean`);
    return undefined;
  }

  return value;
}

function validateCommonVersionFields(
  body: Record<string, unknown>,
  errors: string[]
) {
  const version = readTrimmedString(body, "version", "version", errors) ?? "";
  const manifestPath =
    readTrimmedString(body, "manifestPath", "manifestPath", errors) ?? "";
  const entryPath = readTrimmedString(body, "entryPath", "entryPath", errors) ?? "";
  const exportName =
    readTrimmedString(body, "exportName", "exportName", errors) ?? "";
  const integrity = readTrimmedString(
    body,
    "integrity",
    "integrity",
    errors,
    false
  );
  const publishImmediately = readBoolean(
    body,
    "publishImmediately",
    "publishImmediately",
    errors
  );

  if (version && !semverPattern.test(version)) {
    errors.push("version must be a semantic version, e.g. 1.0.0");
  }

  if (manifestPath && !manifestPath.startsWith("/")) {
    errors.push("manifestPath must be an absolute path starting with /");
  }

  if (entryPath && !entryPath.startsWith("/")) {
    errors.push("entryPath must be an absolute path starting with /");
  }

  if (integrity && !/^sha256:[a-f0-9]{64}$/i.test(integrity)) {
    errors.push("integrity must be a sha256:<hex> hash");
  }

  return { version, manifestPath, entryPath, exportName, integrity, publishImmediately };
}

export function parseCreateUiPackageInput(
  body: unknown
): UiPackageValidationResult<CreateUiPackageInput> {
  const errors: string[] = [];

  if (!isRecord(body)) {
    return { ok: false, errors: ["Package payload must be an object"] };
  }

  const packageId =
    readTrimmedString(body, "packageId", "packageId", errors)?.toLowerCase() ?? "";
  const pid = readTrimmedString(body, "pid", "pid", errors)?.toUpperCase() ?? "";
  const displayName =
    readTrimmedString(body, "displayName", "displayName", errors) ?? "";

  if (packageId && !packageIdPattern.test(packageId)) {
    errors.push("packageId must be lowercase kebab-case, e.g. tank-guard-mobile");
  }

  const { version, manifestPath, entryPath, exportName, integrity, publishImmediately } =
    validateCommonVersionFields(body, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      packageId,
      pid,
      displayName,
      version,
      manifestPath,
      entryPath,
      exportName,
      ...(integrity ? { integrity } : {}),
      ...(publishImmediately !== undefined ? { publishImmediately } : {})
    }
  };
}

export function parseAddUiPackageVersionInput(
  body: unknown
): UiPackageValidationResult<AddUiPackageVersionInput> {
  const errors: string[] = [];

  if (!isRecord(body)) {
    return { ok: false, errors: ["Version payload must be an object"] };
  }

  const { version, manifestPath, entryPath, exportName, integrity, publishImmediately } =
    validateCommonVersionFields(body, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      version,
      manifestPath,
      entryPath,
      exportName,
      ...(integrity ? { integrity } : {}),
      ...(publishImmediately !== undefined ? { publishImmediately } : {})
    }
  };
}
