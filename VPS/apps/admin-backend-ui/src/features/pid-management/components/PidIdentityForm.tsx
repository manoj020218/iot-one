import type { CreatePidInput } from "@jenix/device-schemas";
import type { ProductStatus } from "@jenix/shared";

import type { RootFieldUpdater } from "./pidForm.types";

const statusOptions: ProductStatus[] = [
  "draft",
  "prototype",
  "beta",
  "production",
  "discontinued"
];

export interface PidIdentityFormProps {
  draft: CreatePidInput;
  updateRoot: RootFieldUpdater;
}

export function PidIdentityForm({
  draft,
  updateRoot
}: PidIdentityFormProps) {
  return (
    <section className="form-card">
      <h2>Product Identity</h2>
      <div className="form-grid">
        <label className="field">
          <span>PID</span>
          <input
            value={draft.pid}
            onChange={(event) =>
              updateRoot("pid", event.target.value.toUpperCase())
            }
          />
        </label>
        <label className="field">
          <span>Product Name</span>
          <input
            value={draft.productName}
            onChange={(event) => updateRoot("productName", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <input
            value={draft.productCategory}
            onChange={(event) =>
              updateRoot("productCategory", event.target.value)
            }
          />
        </label>
        <label className="field">
          <span>Product Line</span>
          <input
            value={draft.productLine}
            onChange={(event) => updateRoot("productLine", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select
            value={draft.status}
            onChange={(event) =>
              updateRoot("status", event.target.value as CreatePidInput["status"])
            }
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            value={draft.description ?? ""}
            onChange={(event) =>
              updateRoot("description", event.target.value || undefined)
            }
          />
        </label>
      </div>
    </section>
  );
}
