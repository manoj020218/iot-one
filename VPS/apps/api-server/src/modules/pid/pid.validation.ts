import {
  matterModes,
  type CreatePidInput,
  type MatterCertificationStatus,
  type PidApiProfile,
  type PidDashboardProfile,
  type PidFirmwareProfile,
  type PidHardwareProfile,
  type PidMatterProfile,
  type PidUiProfile
} from "@jenix/device-schemas";
import type { ProductStatus } from "@jenix/shared";

import type { PidPatchPayload, PidValidationResult } from "./pid.types";

const productStatuses: ProductStatus[] = [
  "draft",
  "prototype",
  "beta",
  "production",
  "discontinued"
];

const matterCertificationStatuses: MatterCertificationStatus[] = [
  "not_started",
  "testing",
  "certified",
  "not_required"
];

const pidUiModes: PidUiProfile["uiMode"][] = ["builtin", "remote-package"];

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
  errors: string[],
  required = true
): boolean | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    if (required) {
      errors.push(`${label} is required`);
    }
    return undefined;
  }

  if (typeof value !== "boolean") {
    errors.push(`${label} must be a boolean`);
    return undefined;
  }

  return value;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[]
): number | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number`);
    return undefined;
  }

  return value;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[],
  fallback: string[] = []
): string[] {
  const value = record[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} must be an array of strings`);
    return fallback;
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function readRecordArray(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[]
): Array<Record<string, unknown>> | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    errors.push(`${label} must be an array of objects`);
    return undefined;
  }

  return structuredClone(value);
}

function readObject(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[]
): Record<string, unknown> | undefined {
  const value = record[key];

  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return undefined;
  }

  return value;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value
  } as Record<K, V>;
}

function parseHardwareProfile(
  value: Record<string, unknown>,
  errors: string[]
): PidHardwareProfile {
  const pcbRevision = readTrimmedString(
    value,
    "pcbRevision",
    "hardware.pcbRevision",
    errors,
    false
  );
  const powerType = readTrimmedString(
    value,
    "powerType",
    "hardware.powerType",
    errors,
    false
  );
  const inputCount = readNumber(value, "inputCount", "hardware.inputCount", errors);
  const outputCount = readNumber(
    value,
    "outputCount",
    "hardware.outputCount",
    errors
  );
  const relayCount = readNumber(value, "relayCount", "hardware.relayCount", errors);
  const notes = readTrimmedString(value, "notes", "hardware.notes", errors, false);

  return {
    mcu: readTrimmedString(value, "mcu", "hardware.mcu", errors) ?? "",
    hardwareRevision:
      readTrimmedString(
        value,
        "hardwareRevision",
        "hardware.hardwareRevision",
        errors
      ) ?? "",
    hasRs485:
      readBoolean(value, "hasRs485", "hardware.hasRs485", errors) ?? false,
    hasBle: readBoolean(value, "hasBle", "hardware.hasBle", errors) ?? false,
    hasWifi: readBoolean(value, "hasWifi", "hardware.hasWifi", errors) ?? false,
    hasMatter:
      readBoolean(value, "hasMatter", "hardware.hasMatter", errors) ?? false,
    hasThread:
      readBoolean(value, "hasThread", "hardware.hasThread", errors) ?? false,
    hasEthernet:
      readBoolean(value, "hasEthernet", "hardware.hasEthernet", errors) ?? false,
    ...optionalProp("pcbRevision", pcbRevision),
    ...optionalProp("powerType", powerType),
    ...optionalProp("inputCount", inputCount),
    ...optionalProp("outputCount", outputCount),
    ...optionalProp("relayCount", relayCount),
    ...optionalProp("notes", notes)
  };
}

function parseFirmwareProfile(
  value: Record<string, unknown>,
  errors: string[]
): PidFirmwareProfile {
  const stableVersion = readTrimmedString(
    value,
    "stableVersion",
    "firmware.stableVersion",
    errors,
    false
  );
  const betaVersion = readTrimmedString(
    value,
    "betaVersion",
    "firmware.betaVersion",
    errors,
    false
  );
  const minHardwareRevision = readTrimmedString(
    value,
    "minHardwareRevision",
    "firmware.minHardwareRevision",
    errors,
    false
  );
  const maxHardwareRevision = readTrimmedString(
    value,
    "maxHardwareRevision",
    "firmware.maxHardwareRevision",
    errors,
    false
  );
  const buildNotes = readTrimmedString(
    value,
    "buildNotes",
    "firmware.buildNotes",
    errors,
    false
  );

  return {
    firmwareFamily:
      readTrimmedString(
        value,
        "firmwareFamily",
        "firmware.firmwareFamily",
        errors
      ) ?? "",
    otaChannel:
      readTrimmedString(value, "otaChannel", "firmware.otaChannel", errors) ?? "",
    rollbackAllowed:
      readBoolean(
        value,
        "rollbackAllowed",
        "firmware.rollbackAllowed",
        errors
      ) ?? false,
    ...optionalProp("stableVersion", stableVersion),
    ...optionalProp("betaVersion", betaVersion),
    ...optionalProp("minHardwareRevision", minHardwareRevision),
    ...optionalProp("maxHardwareRevision", maxHardwareRevision),
    ...optionalProp("buildNotes", buildNotes)
  };
}

function parseMatterProfile(
  value: Record<string, unknown>,
  errors: string[]
): PidMatterProfile {
  const mode =
    readTrimmedString(value, "mode", "matter.mode", errors) ?? "NONE";
  const certificationStatus = readTrimmedString(
    value,
    "certificationStatus",
    "matter.certificationStatus",
    errors,
    false
  );

  if (!matterModes.includes(mode as (typeof matterModes)[number])) {
    errors.push("matter.mode must be a supported Matter mode");
  }

  if (
    certificationStatus &&
    !matterCertificationStatuses.includes(
      certificationStatus as MatterCertificationStatus
    )
  ) {
    errors.push("matter.certificationStatus is invalid");
  }

  const deviceType = readTrimmedString(
    value,
    "deviceType",
    "matter.deviceType",
    errors,
    false
  );
  const endpoints = readRecordArray(value, "endpoints", "matter.endpoints", errors);
  const clusters = readStringArray(value, "clusters", "matter.clusters", errors);
  const vendorId = readTrimmedString(
    value,
    "vendorId",
    "matter.vendorId",
    errors,
    false
  );
  const productId = readTrimmedString(
    value,
    "productId",
    "matter.productId",
    errors,
    false
  );
  const discriminator = readTrimmedString(
    value,
    "discriminator",
    "matter.discriminator",
    errors,
    false
  );

  return {
    enabled: readBoolean(value, "enabled", "matter.enabled", errors) ?? false,
    mode: matterModes.includes(mode as (typeof matterModes)[number])
      ? (mode as PidMatterProfile["mode"])
      : "NONE",
    bridgeSupported:
      readBoolean(
        value,
        "bridgeSupported",
        "matter.bridgeSupported",
        errors
      ) ?? false,
    ...optionalProp("deviceType", deviceType),
    ...optionalProp("endpoints", endpoints),
    ...optionalProp("clusters", clusters),
    ...optionalProp("vendorId", vendorId),
    ...optionalProp("productId", productId),
    ...optionalProp("discriminator", discriminator),
    ...optionalProp(
      "certificationStatus",
      certificationStatus as MatterCertificationStatus | undefined
    )
  };
}

function parseApiProfile(
  value: Record<string, unknown>,
  errors: string[]
): PidApiProfile {
  const defaultPackageId = readTrimmedString(
    value,
    "defaultPackageId",
    "api.defaultPackageId",
    errors,
    false
  );
  const webhookSupport = readBoolean(
    value,
    "webhookSupport",
    "api.webhookSupport",
    errors,
    false
  );
  const mqttBridgeSupport = readBoolean(
    value,
    "mqttBridgeSupport",
    "api.mqttBridgeSupport",
    errors,
    false
  );

  return {
    enabled: readBoolean(value, "enabled", "api.enabled", errors) ?? false,
    sellable: readBoolean(value, "sellable", "api.sellable", errors) ?? false,
    allowedScopes: readStringArray(
      value,
      "allowedScopes",
      "api.allowedScopes",
      errors
    ),
    ...optionalProp("defaultPackageId", defaultPackageId),
    ...optionalProp("webhookSupport", webhookSupport),
    ...optionalProp("mqttBridgeSupport", mqttBridgeSupport)
  };
}

function parseDashboardProfile(
  value: Record<string, unknown>,
  errors: string[]
): PidDashboardProfile {
  const icon = readTrimmedString(value, "icon", "dashboard.icon", errors, false);
  const cardLayout = readTrimmedString(
    value,
    "cardLayout",
    "dashboard.cardLayout",
    errors,
    false
  );

  return {
    templateId:
      readTrimmedString(
        value,
        "templateId",
        "dashboard.templateId",
        errors
      ) ?? "",
    dynamicPages: readStringArray(
      value,
      "dynamicPages",
      "dashboard.dynamicPages",
      errors
    ),
    ...optionalProp("icon", icon),
    ...optionalProp("cardLayout", cardLayout)
  };
}

function parseUiProfile(
  value: Record<string, unknown>,
  errors: string[]
): PidUiProfile {
  const uiMode = readTrimmedString(value, "uiMode", "ui.uiMode", errors) ?? "builtin";
  const uiPackageId = readTrimmedString(
    value,
    "uiPackageId",
    "ui.uiPackageId",
    errors,
    false
  );
  const uiPackageVersion = readTrimmedString(
    value,
    "uiPackageVersion",
    "ui.uiPackageVersion",
    errors,
    false
  );

  if (!pidUiModes.includes(uiMode as PidUiProfile["uiMode"])) {
    errors.push("ui.uiMode must be a supported UI package mode");
  }

  if (uiMode === "remote-package") {
    if (!uiPackageId) {
      errors.push("ui.uiPackageId is required when ui.uiMode is remote-package");
    }

    if (!uiPackageVersion) {
      errors.push("ui.uiPackageVersion is required when ui.uiMode is remote-package");
    }
  }

  return {
    uiMode: uiMode as PidUiProfile["uiMode"],
    ...optionalProp("uiPackageId", uiPackageId),
    ...optionalProp("uiPackageVersion", uiPackageVersion)
  };
}

export function parseCreatePidInput(body: unknown): PidValidationResult<CreatePidInput> {
  const errors: string[] = [];

  if (!isRecord(body)) {
    return {
      ok: false,
      errors: ["PID payload must be an object"]
    };
  }

  const pid = readTrimmedString(body, "pid", "pid", errors)?.toUpperCase() ?? "";
  const productName =
    readTrimmedString(body, "productName", "productName", errors) ?? "";
  const productCategory =
    readTrimmedString(body, "productCategory", "productCategory", errors) ?? "";
  const productLine =
    readTrimmedString(body, "productLine", "productLine", errors) ?? "";
  const status = readTrimmedString(body, "status", "status", errors) ?? "draft";
  const matterMode =
    readTrimmedString(body, "matterMode", "matterMode", errors) ?? "NONE";
  const brand = readTrimmedString(body, "brand", "brand", errors) ?? "";

  if (!/^JNX-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(pid)) {
    errors.push("pid must follow the JNX-... product identity format");
  }

  if (!productStatuses.includes(status as ProductStatus)) {
    errors.push("status must be a supported product status");
  }

  if (!matterModes.includes(matterMode as (typeof matterModes)[number])) {
    errors.push("matterMode must be a supported Matter mode");
  }

  if (brand !== "JENIX") {
    errors.push("brand must be JENIX");
  }

  const hardwareValue = readObject(body, "hardware", "hardware", errors);
  const firmwareValue = readObject(body, "firmware", "firmware", errors);
  const matterValue = readObject(body, "matter", "matter", errors);
  const apiValue = readObject(body, "api", "api", errors);
  const uiValue = readObject(body, "ui", "ui", errors);
  const dashboardValue = readObject(body, "dashboard", "dashboard", errors);

  const hardware = hardwareValue
    ? parseHardwareProfile(hardwareValue, errors)
    : undefined;
  const firmware = firmwareValue
    ? parseFirmwareProfile(firmwareValue, errors)
    : undefined;
  const matter = matterValue
    ? parseMatterProfile(matterValue, errors)
    : undefined;
  const api = apiValue ? parseApiProfile(apiValue, errors) : undefined;
  const ui = uiValue ? parseUiProfile(uiValue, errors) : undefined;
  const dashboard = dashboardValue
    ? parseDashboardProfile(dashboardValue, errors)
    : undefined;

  if (!hardware || !firmware || !matter || !api || !ui || !dashboard) {
    return {
      ok: false,
      errors
    };
  }

  if (matter.enabled && matter.mode === "NONE") {
    errors.push("matter.mode cannot be NONE when matter.enabled is true");
  }

  if (!matter.enabled && matter.mode !== "NONE") {
    errors.push("matter.mode must be NONE when matter.enabled is false");
  }

  if (matter.enabled && !hardware.hasMatter) {
    errors.push("hardware.hasMatter must be true when matter.enabled is true");
  }

  if (matterMode !== matter.mode) {
    errors.push("matterMode must match matter.mode");
  }

  if (api.sellable && !api.enabled) {
    errors.push("api.sellable cannot be true when api.enabled is false");
  }

  const description = readTrimmedString(
    body,
    "description",
    "description",
    errors,
    false
  );
  const iconUrl = readTrimmedString(
    body,
    "iconUrl",
    "iconUrl",
    errors,
    false
  );
  const imageUrl = readTrimmedString(
    body,
    "imageUrl",
    "imageUrl",
    errors,
    false
  );

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    data: {
      pid,
      productName,
      productCategory,
      productLine,
      status: status as ProductStatus,
      matterMode: matterMode as CreatePidInput["matterMode"],
      brand: "JENIX",
      hardware,
      firmware,
      matter,
      api,
      ui,
      dashboard,
      ...optionalProp("description", description),
      ...optionalProp("iconUrl", iconUrl),
      ...optionalProp("imageUrl", imageUrl)
    }
  };
}

export function parsePidPatchInput(
  body: unknown
): PidValidationResult<PidPatchPayload> {
  if (!isRecord(body)) {
    return {
      ok: false,
      errors: ["PID patch payload must be an object"]
    };
  }

  const forbiddenKeys = [
    "pid",
    "createdBy",
    "createdAt",
    "updatedAt",
    "approvedBy",
    "approvedAt"
  ];
  const presentForbiddenKeys = forbiddenKeys.filter((key) => key in body);

  if (presentForbiddenKeys.length > 0) {
    return {
      ok: false,
      errors: [`PID patch cannot change protected fields: ${presentForbiddenKeys.join(", ")}`]
    };
  }

  if (Object.keys(body).length === 0) {
    return {
      ok: false,
      errors: ["PID patch payload cannot be empty"]
    };
  }

  return {
    ok: true,
    data: structuredClone(body)
  };
}
