import type { CreatePidInput } from "@jenix/device-schemas";

import type { ApiFieldUpdater } from "./pidForm.types";

export interface PidApiPackageFormProps {
  api: CreatePidInput["api"];
  updateApi: ApiFieldUpdater;
}

export function PidApiPackageForm({
  api,
  updateApi
}: PidApiPackageFormProps) {
  return (
    <section className="form-card">
      <h2>API Package</h2>
      <div className="form-grid">
        <label className="field checkbox-field">
          <span>API Enabled</span>
          <input
            type="checkbox"
            checked={api.enabled}
            onChange={(event) => updateApi("enabled", event.target.checked)}
          />
        </label>
        <label className="field checkbox-field">
          <span>Sellable Package</span>
          <input
            type="checkbox"
            checked={api.sellable}
            onChange={(event) => updateApi("sellable", event.target.checked)}
          />
        </label>
        <label className="field">
          <span>Default Package ID</span>
          <input
            value={api.defaultPackageId ?? ""}
            onChange={(event) =>
              updateApi("defaultPackageId", event.target.value || undefined)
            }
          />
        </label>
        <label className="field">
          <span>Allowed Scopes</span>
          <input
            value={api.allowedScopes.join(", ")}
            onChange={(event) =>
              updateApi(
                "allowedScopes",
                event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>
      </div>
    </section>
  );
}
