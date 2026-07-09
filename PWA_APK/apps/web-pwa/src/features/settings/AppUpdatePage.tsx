import { AppShell, StatusPill } from "@jenix/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";

const currentAppRelease = {
  version: "0.1.0",
  channel: "preview",
  updatedAt: "2026-07-02"
} as const;

export function AppUpdatePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  if (!session) {
    throw new Error("AppUpdatePage requires an authenticated session");
  }

  return (
    <AppShell
      eyebrow="App Update"
      title="PWA and Wrapper Update Status"
      description="App delivery stays separate from PID-scoped firmware. This page tracks operator-facing wrapper and web-shell update guidance."
      aside={<StatusPill label={currentAppRelease.channel.toUpperCase()} tone="neutral" />}
    >
      <section className="tabs-strip">
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/settings")}
        >
          Settings
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/home")}
        >
          Dashboard
        </button>
      </section>
      <section className="panel">
        <dl className="summary-grid">
          <div>
            <dt>Current Version</dt>
            <dd>{currentAppRelease.version}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>{currentAppRelease.channel}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{currentAppRelease.updatedAt}</dd>
          </div>
        </dl>
        <div className="card-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              setMessage(
                "The current web shell is up to date. Android wrapper updates should be distributed when native BLE or packaging changes land."
              )
            }
          >
            Check for App Update
          </button>
        </div>
        {message ? <p className="provisioning-note">{message}</p> : null}
      </section>
      <section className="content-grid">
        <article className="panel">
          <h2>Web PWA</h2>
          <p className="hint-text">
            The PWA updates through the deployed web shell at `app.iotsoft.in`.
          </p>
        </article>
        <article className="panel">
          <h2>Android Wrapper</h2>
          <p className="hint-text">
            Native BLE packaging and plugin changes must be shipped through the Android
            wrapper build, not only the web layer.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
