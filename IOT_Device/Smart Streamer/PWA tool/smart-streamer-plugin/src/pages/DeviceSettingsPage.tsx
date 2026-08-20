import { React } from "../host";
import { DEMO_NOTIFICATION_PREFS } from "../demoNotificationPrefs";
import { ToggleField, TextField } from "../components/FormFields";

// Named "Device Settings" in the nav (navSections.ts) deliberately — the
// platform already has its own top-level "Settings" (account/home
// management, /settings). This page is scoped to Smart Streamer only;
// it never touches platform-wide settings.
export function DeviceSettingsPage() {
  const [prefs, setPrefs] = React.useState(DEMO_NOTIFICATION_PREFS);
  const [transport, setTransport] = React.useState("tcp");
  const [timeout, setTimeoutValue] = React.useState("5");
  const [rotation, setRotation] = React.useState("0");

  function togglePref(eventId: string, enabled: boolean): void {
    setPrefs((current) =>
      current.map((pref) => (pref.eventId === eventId ? { ...pref, enabled } : pref))
    );
  }

  return (
    <section>
      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Notifications</span>
            <h2 style={{ marginBottom: 4 }}>Stream Event Preferences</h2>
            <p className="hint-text">
              Per-user, deduplicated and cooldown-limited server-side (Streamer Plugin.txt
              §16). Demo toggles — wired once the platform notification framework exists
              (see SMART_STREAMER_PLATFORM_ADDITIONS.md item 3).
            </p>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          {prefs.map((pref) => (
            <ToggleField
              checked={pref.enabled}
              key={pref.eventId}
              label={pref.label}
              onChange={(checked) => togglePref(pref.eventId, checked)}
            />
          ))}
        </div>
        <div className="card-actions" style={{ marginTop: 12 }}>
          <button className="text-button" disabled type="button">
            Save Preferences
          </button>
        </div>
      </article>

      <article className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Camera Defaults</span>
            <h2 style={{ marginBottom: 4 }}>New Camera Defaults</h2>
            <p className="hint-text">
              Applied when creating a new camera profile — override per-camera on the
              Cameras page at any time.
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 8 }}>
          <TextField label="Default RTSP Transport" onChange={setTransport} value={transport} />
          <TextField label="Default Connection Timeout (s)" onChange={setTimeoutValue} value={timeout} />
          <TextField label="Default Rotation (deg)" onChange={setRotation} value={rotation} />
        </div>
        <div className="card-actions" style={{ marginTop: 12 }}>
          <button className="text-button" disabled type="button">
            Save Defaults
          </button>
        </div>
      </article>
    </section>
  );
}
