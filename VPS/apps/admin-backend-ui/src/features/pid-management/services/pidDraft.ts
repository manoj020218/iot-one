import {
  foundationPidBlueprint,
  type CreatePidInput,
  type ProductPidRecord
} from "@jenix/device-schemas";

const pidPattern = /^JNX-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createEmptyPidDraft(): CreatePidInput {
  return {
    ...clone(foundationPidBlueprint),
    pid: "",
    productName: "",
    productCategory: "",
    productLine: "",
    description: "",
    hardware: {
      ...clone(foundationPidBlueprint.hardware),
      mcu: "",
      hardwareRevision: ""
    },
    firmware: {
      ...clone(foundationPidBlueprint.firmware),
      firmwareFamily: "",
      otaChannel: "",
      stableVersion: ""
    },
    dashboard: {
      ...clone(foundationPidBlueprint.dashboard),
      templateId: ""
    }
  };
}

export function createDraftFromPid(record: ProductPidRecord): CreatePidInput {
  const {
    approvedAt: _approvedAt,
    approvedBy: _approvedBy,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    ...draft
  } = record;

  return clone(draft);
}

export function validatePidDraft(draft: CreatePidInput): string[] {
  const errors: string[] = [];

  if (!pidPattern.test(draft.pid.trim().toUpperCase())) {
    errors.push("PID must follow the JNX-... identity format.");
  }

  if (!draft.productName.trim()) {
    errors.push("Product name is required.");
  }

  if (!draft.productCategory.trim()) {
    errors.push("Product category is required.");
  }

  if (!draft.productLine.trim()) {
    errors.push("Product line is required.");
  }

  if (!draft.hardware.mcu.trim()) {
    errors.push("Hardware MCU is required.");
  }

  if (!draft.hardware.hardwareRevision.trim()) {
    errors.push("Hardware revision is required.");
  }

  if (!draft.firmware.firmwareFamily.trim()) {
    errors.push("Firmware family is required.");
  }

  if (!draft.firmware.otaChannel.trim()) {
    errors.push("OTA channel is required.");
  }

  if (!draft.dashboard.templateId.trim()) {
    errors.push("Dashboard template ID is required.");
  }

  if (draft.matter.enabled && draft.matter.mode === "NONE") {
    errors.push("Matter mode cannot be NONE when Matter is enabled.");
  }

  if (!draft.matter.enabled && draft.matter.mode !== "NONE") {
    errors.push("Matter mode must be NONE when Matter is disabled.");
  }

  if (draft.api.sellable && !draft.api.enabled) {
    errors.push("Sellable API packages must also be API-enabled.");
  }

  return errors;
}
