import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";

export function SettingsHomePage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    throw new Error("SettingsHomePage requires an authenticated session");
  }

  return (
    <AppShell
      eyebrow="Settings"
      title="Settings and App Controls"
      description="Phase 9 collects profile, wrapper, and app-update surfaces without hardcoding product-specific device settings."
      aside={<StatusPill label={session.user.provider.toUpperCase()} tone="neutral" />}
    >
      <section className="tabs-strip">
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/dashboard")}
        >
          Dashboard
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/devices")}
        >
          Device Center
        </button>
      </section>
      <section className="settings-card-grid">
        <button
          className="home-card-button"
          type="button"
          onClick={() => navigate("/settings/profile")}
        >
          <div className="home-card-head">
            <strong>User Profile</strong>
            <span>{session.user.name}</span>
          </div>
          <p className="hint-text">
            Review account identity, provider, and current HOME role.
          </p>
        </button>
        <button
          className="home-card-button"
          type="button"
          onClick={() => navigate("/settings/app")}
        >
          <div className="home-card-head">
            <strong>App Update</strong>
            <span>PWA + Android</span>
          </div>
          <p className="hint-text">
            Check wrapper guidance, current channel, and update notes.
          </p>
        </button>
      </section>
    </AppShell>
  );
}
