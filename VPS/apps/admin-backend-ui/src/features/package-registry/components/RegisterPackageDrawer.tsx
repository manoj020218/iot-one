import { useState } from "react";

import type { ProductPidRecord } from "@jenix/device-schemas";
import type { CreateUiPackageInput } from "@jenix/shared";

import { registerUiPackage } from "../services/uiPackageApi";

export interface RegisterPackageDrawerProps {
  open: boolean;
  pids: ProductPidRecord[];
  onClose: () => void;
  onRegistered: () => void | Promise<void>;
}

const emptyDraft: CreateUiPackageInput = {
  packageId: "",
  pid: "",
  displayName: "",
  version: "0.1.0",
  manifestPath: "",
  entryPath: "",
  exportName: "",
  integrity: "",
  publishImmediately: false
};

export function RegisterPackageDrawer({
  open,
  pids,
  onClose,
  onRegistered
}: RegisterPackageDrawerProps) {
  const [draft, setDraft] = useState<CreateUiPackageInput>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof CreateUiPackageInput>(
    key: K,
    value: CreateUiPackageInput[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const trimmedIntegrity = draft.integrity?.trim();
      const { integrity: _integrity, ...rest } = draft;

      await registerUiPackage({
        ...rest,
        ...(trimmedIntegrity ? { integrity: trimmedIntegrity } : {})
      });
      setDraft(emptyDraft);
      await onRegistered();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to register package."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer">
        <div className="dhead">
          <div>
            <h3>Register package</h3>
            <p>Adds a row to the registry — no deploy required to bind it to a PID.</p>
          </div>
          <div className="spacer" />
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="dbody">
          {error ? <div className="validation-card">{error}</div> : null}
          <div className="callout">
            Publishing still requires an integrity hash once package signing ships. Draft
            packages can be registered without one.
          </div>
          <div className="field">
            <label htmlFor="pr-package-id">Package ID</label>
            <input
              id="pr-package-id"
              className="mono"
              value={draft.packageId}
              onChange={(event) => updateField("packageId", event.target.value)}
              placeholder="p10-token-display"
            />
          </div>
          <div className="field">
            <label htmlFor="pr-display-name">Display name</label>
            <input
              id="pr-display-name"
              value={draft.displayName}
              onChange={(event) => updateField("displayName", event.target.value)}
              placeholder="P10 LED Token Display remote UI"
            />
          </div>
          <div className="field">
            <label htmlFor="pr-pid">Bound PID</label>
            <select
              id="pr-pid"
              value={draft.pid}
              onChange={(event) => updateField("pid", event.target.value)}
            >
              <option value="">Select a PID…</option>
              {pids.map((pid) => (
                <option key={pid.pid} value={pid.pid}>
                  {pid.pid} — {pid.productName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="pr-version">Version (semver)</label>
              <input
                id="pr-version"
                className="mono"
                value={draft.version}
                onChange={(event) => updateField("version", event.target.value)}
              />
            </div>
            <div className="field checkbox-field">
              <label htmlFor="pr-publish">
                <input
                  id="pr-publish"
                  type="checkbox"
                  checked={Boolean(draft.publishImmediately)}
                  onChange={(event) =>
                    updateField("publishImmediately", event.target.checked)
                  }
                />{" "}
                Publish immediately
              </label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pr-manifest">Manifest path</label>
            <input
              id="pr-manifest"
              className="mono"
              value={draft.manifestPath}
              onChange={(event) => updateField("manifestPath", event.target.value)}
              placeholder="/ui-packages/p10-token-display/0.1.0/manifest.json"
            />
          </div>
          <div className="field">
            <label htmlFor="pr-entry">Entry path</label>
            <input
              id="pr-entry"
              className="mono"
              value={draft.entryPath}
              onChange={(event) => updateField("entryPath", event.target.value)}
              placeholder="/ui-packages/p10-token-display/0.1.0/remoteEntry.js"
            />
          </div>
          <div className="field">
            <label htmlFor="pr-export">Export name</label>
            <input
              id="pr-export"
              className="mono"
              value={draft.exportName}
              onChange={(event) => updateField("exportName", event.target.value)}
              placeholder="P10TokenDisplayDynamicPage"
            />
          </div>
          <div className="field">
            <label htmlFor="pr-integrity">
              Integrity hash (sha256) — optional while draft
            </label>
            <input
              id="pr-integrity"
              className="mono"
              value={draft.integrity ?? ""}
              onChange={(event) => updateField("integrity", event.target.value)}
              placeholder="sha256:…"
            />
          </div>
        </div>
        <div className="dfoot">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Saving…" : "Save to registry"}
          </button>
        </div>
      </aside>
    </>
  );
}
