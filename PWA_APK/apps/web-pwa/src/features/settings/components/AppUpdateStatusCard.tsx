import { useEffect, useState } from "react";

import {
  applyAvailableUpdate,
  getAppUpdateStatus,
  type AppUpdateStatus
} from "../services/appUpdateApi";

export function AppUpdateStatusCard() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setChecking(true);
    const next = await getAppUpdateStatus();
    setStatus(next);
    setMessage(next.notes ?? null);
    setChecking(false);
  }

  async function handleUpdate() {
    if (!status) {
      return;
    }

    setMessage(await applyAvailableUpdate(status));
  }

  return (
    <section className="panel">
      <div className="home-card-head">
        <strong>App Update</strong>
        <span>{status?.channel ?? "preview"}</span>
      </div>
      <dl className="summary-grid">
        <div><dt>Current Version</dt><dd>{status?.currentVersion ?? "Loading..."}</dd></div>
        <div><dt>Latest Version</dt><dd>{status?.latestVersion ?? "Loading..."}</dd></div>
        <div><dt>Updated</dt><dd>{status?.updatedAt ?? "Loading..."}</dd></div>
      </dl>
      <div className="button-row">
        <button className="secondary-button" onClick={() => void refresh()} type="button">
          {checking ? "Checking..." : "Check for Update"}
        </button>
        <button
          className="primary-button"
          disabled={!status?.hasUpdate}
          onClick={() => void handleUpdate()}
          type="button"
        >
          {status?.hasUpdate ? "Download Update" : "Already Current"}
        </button>
      </div>
      {message ? <p className="hint-text">{message}</p> : null}
    </section>
  );
}
