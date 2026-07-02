import { matterModes, type CreatePidInput } from "@jenix/device-schemas";

import type { MatterFieldUpdater } from "./pidForm.types";

export interface PidMatterMappingFormProps {
  matter: CreatePidInput["matter"];
  updateMatter: MatterFieldUpdater;
}

export function PidMatterMappingForm({
  matter,
  updateMatter
}: PidMatterMappingFormProps) {
  return (
    <section className="form-card">
      <h2>Matter Mapping</h2>
      <div className="form-grid">
        <label className="field checkbox-field">
          <span>Matter Enabled</span>
          <input
            type="checkbox"
            checked={matter.enabled}
            onChange={(event) =>
              updateMatter("enabled", event.target.checked)
            }
          />
        </label>
        <label className="field">
          <span>Matter Mode</span>
          <select
            value={matter.mode}
            onChange={(event) =>
              updateMatter("mode", event.target.value as CreatePidInput["matter"]["mode"])
            }
          >
            {matterModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Device Type</span>
          <input
            value={matter.deviceType ?? ""}
            onChange={(event) =>
              updateMatter("deviceType", event.target.value || undefined)
            }
          />
        </label>
        <label className="field checkbox-field">
          <span>Bridge Supported</span>
          <input
            type="checkbox"
            checked={matter.bridgeSupported}
            onChange={(event) =>
              updateMatter("bridgeSupported", event.target.checked)
            }
          />
        </label>
        <label className="field">
          <span>Clusters</span>
          <input
            value={matter.clusters?.join(", ") ?? ""}
            onChange={(event) =>
              updateMatter(
                "clusters",
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
