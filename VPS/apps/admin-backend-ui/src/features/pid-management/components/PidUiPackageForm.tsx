import type { CreatePidInput } from "@jenix/device-schemas";

import type { UiFieldUpdater } from "./pidForm.types";

export interface PidUiPackageFormProps {
  ui: CreatePidInput["ui"];
  updateUi: UiFieldUpdater;
}

export function PidUiPackageForm({ ui, updateUi }: PidUiPackageFormProps) {
  const remote = ui.uiMode === "remote-package";

  return (
    <section className="form-card">
      <h2>UI Package</h2>
      <div className="form-grid">
        <label className="field">
          <span>UI Mode</span>
          <select
            value={ui.uiMode}
            onChange={(event) =>
              updateUi("uiMode", event.target.value as CreatePidInput["ui"]["uiMode"])
            }
          >
            <option value="builtin">Builtin Shell</option>
            <option value="remote-package">Remote Package</option>
          </select>
        </label>
        <label className="field">
          <span>UI Package ID</span>
          <input
            value={ui.uiPackageId ?? ""}
            disabled={!remote}
            onChange={(event) =>
              updateUi("uiPackageId", event.target.value || undefined)
            }
          />
        </label>
        <label className="field">
          <span>UI Package Version</span>
          <input
            value={ui.uiPackageVersion ?? ""}
            disabled={!remote}
            onChange={(event) =>
              updateUi("uiPackageVersion", event.target.value || undefined)
            }
          />
        </label>
      </div>
    </section>
  );
}
