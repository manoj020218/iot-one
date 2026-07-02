import type { CreatePidInput } from "@jenix/device-schemas";

import type { DashboardFieldUpdater } from "./pidForm.types";

export interface PidDashboardTemplateFormProps {
  dashboard: CreatePidInput["dashboard"];
  updateDashboard: DashboardFieldUpdater;
}

export function PidDashboardTemplateForm({
  dashboard,
  updateDashboard
}: PidDashboardTemplateFormProps) {
  return (
    <section className="form-card">
      <h2>Dashboard Template</h2>
      <div className="form-grid">
        <label className="field">
          <span>Template ID</span>
          <input
            value={dashboard.templateId}
            onChange={(event) =>
              updateDashboard("templateId", event.target.value)
            }
          />
        </label>
        <label className="field">
          <span>Dynamic Pages</span>
          <input
            value={dashboard.dynamicPages.join(", ")}
            onChange={(event) =>
              updateDashboard(
                "dynamicPages",
                event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>
        <label className="field">
          <span>Icon</span>
          <input
            value={dashboard.icon ?? ""}
            onChange={(event) =>
              updateDashboard("icon", event.target.value || undefined)
            }
          />
        </label>
        <label className="field">
          <span>Card Layout</span>
          <input
            value={dashboard.cardLayout ?? ""}
            onChange={(event) =>
              updateDashboard("cardLayout", event.target.value || undefined)
            }
          />
        </label>
      </div>
    </section>
  );
}
