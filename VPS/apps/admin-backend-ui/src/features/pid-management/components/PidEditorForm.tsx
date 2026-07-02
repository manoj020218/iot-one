import type { CreatePidInput } from "@jenix/device-schemas";

import { PidApiPackageForm } from "./PidApiPackageForm";
import { PidDashboardTemplateForm } from "./PidDashboardTemplateForm";
import { PidFirmwareForm } from "./PidFirmwareForm";
import { PidHardwareForm } from "./PidHardwareForm";
import { PidIdentityForm } from "./PidIdentityForm";
import { PidMatterMappingForm } from "./PidMatterMappingForm";
import { ValidationSummary } from "./ValidationSummary";

export interface PidEditorFormProps {
  draft: CreatePidInput;
  errors: string[];
  submitLabel: string;
  onSubmit: () => Promise<void>;
  onDraftChange: (updater: (current: CreatePidInput) => CreatePidInput) => void;
}

export function PidEditorForm({
  draft,
  errors,
  submitLabel,
  onSubmit,
  onDraftChange
}: PidEditorFormProps) {
  const updateRoot = <K extends keyof CreatePidInput>(
    field: K,
    value: CreatePidInput[K]
  ) => {
    onDraftChange((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateHardware = <K extends keyof CreatePidInput["hardware"]>(
    field: K,
    value: CreatePidInput["hardware"][K]
  ) => {
    onDraftChange((current) => ({
      ...current,
      hardware: {
        ...current.hardware,
        [field]: value
      }
    }));
  };

  const updateFirmware = <K extends keyof CreatePidInput["firmware"]>(
    field: K,
    value: CreatePidInput["firmware"][K]
  ) => {
    onDraftChange((current) => ({
      ...current,
      firmware: {
        ...current.firmware,
        [field]: value
      }
    }));
  };

  const updateMatter = <K extends keyof CreatePidInput["matter"]>(
    field: K,
    value: CreatePidInput["matter"][K]
  ) => {
    onDraftChange((current) => ({
      ...current,
      matter: {
        ...current.matter,
        [field]: value
      }
    }));
  };

  const updateApi = <K extends keyof CreatePidInput["api"]>(
    field: K,
    value: CreatePidInput["api"][K]
  ) => {
    onDraftChange((current) => ({
      ...current,
      api: {
        ...current.api,
        [field]: value
      }
    }));
  };

  const updateDashboard = <K extends keyof CreatePidInput["dashboard"]>(
    field: K,
    value: CreatePidInput["dashboard"][K]
  ) => {
    onDraftChange((current) => ({
      ...current,
      dashboard: {
        ...current.dashboard,
        [field]: value
      }
    }));
  };

  return (
    <form
      className="editor-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <ValidationSummary errors={errors} />
      <PidIdentityForm draft={draft} updateRoot={updateRoot} />
      <PidHardwareForm hardware={draft.hardware} updateHardware={updateHardware} />
      <PidFirmwareForm
        firmware={draft.firmware}
        updateFirmware={updateFirmware}
      />
      <PidMatterMappingForm matter={draft.matter} updateMatter={updateMatter} />
      <PidApiPackageForm api={draft.api} updateApi={updateApi} />
      <PidDashboardTemplateForm
        dashboard={draft.dashboard}
        updateDashboard={updateDashboard}
      />
      <div className="form-actions">
        <button className="primary-button" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
