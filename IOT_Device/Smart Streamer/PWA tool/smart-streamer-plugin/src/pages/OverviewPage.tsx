import { React } from "../host";
import { DEMO_STREAMER_DEVICES, type StreamerDeviceSummary } from "../demoDevices";
import { DEMO_STREAMER_DESTINATIONS, PLATFORM_LABELS } from "../demoDestinations";
import { DEMO_STREAMER_SCHEDULES, WEEKDAYS } from "../demoSchedules";
import { DEMO_STREAMER_SESSIONS } from "../demoSessions";
import { DEMO_DEVICE_HEALTH } from "../demoDiagnostics";
import { formatDuration } from "../utils/formatDuration";

interface OverviewPageProps {
  onNavigate: (section: string) => void;
}

// Demo-only reference point for "firmware update available" — replace
// with the resolved firmware plan once OTA is wired to the real API.
const LATEST_FIRMWARE_VERSION = "1.1.0";

function isExpired(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() < Date.now();
}

function todayAbbreviation(): string {
  const index = (new Date().getDay() + 6) % 7;
  return WEEKDAYS[index] ?? "Mon";
}

function primaryActionFor(device: StreamerDeviceSummary): { label: string; section: string } {
  const health = DEMO_DEVICE_HEALTH.find((entry) => entry.deviceId === device.deviceId);

  if (device.onlineStatus === "offline") return { label: "Diagnose", section: "diagnostics" };
  if (health?.lastError) return { label: "Diagnose", section: "diagnostics" };
  if (device.streamState === "STREAMING") return { label: "View / Stop", section: "sessions" };

  const destination = device.activeDestinationPlatform
    ? DEMO_STREAMER_DESTINATIONS.find((entry) => entry.platform === device.activeDestinationPlatform)
    : undefined;
  if (destination && isExpired(destination.credentialExpiry)) {
    return { label: "Update Destination", section: "destinations" };
  }
  if (device.firmwareVersion !== LATEST_FIRMWARE_VERSION) return { label: "Review OTA", section: "ota" };

  return { label: "Start Stream", section: "devices" };
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <article className="panel" style={{ padding: "12px 14px" }}>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{value}</p>
      <p className="hint-text" style={{ margin: 0 }}>{label}</p>
    </article>
  );
}

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  const today = todayAbbreviation();
  const total = DEMO_STREAMER_DEVICES.length;
  const online = DEMO_STREAMER_DEVICES.filter((d) => d.onlineStatus === "online").length;
  const streamingNow = DEMO_STREAMER_DEVICES.filter((d) => d.streamState === "STREAMING").length;
  const scheduledToday = DEMO_STREAMER_SCHEDULES.filter((s) => s.daysOfWeek.includes(today)).length;
  const needsAttention = DEMO_DEVICE_HEALTH.filter((h) => h.lastError !== null).length;
  const expiredCredentials = DEMO_STREAMER_DESTINATIONS.filter((d) => isExpired(d.credentialExpiry)).length;
  const firmwareUpdates = DEMO_STREAMER_DEVICES.filter((d) => d.firmwareVersion !== LATEST_FIRMWARE_VERSION).length;

  return (
    <section>
      <p className="hint-text" style={{ marginBottom: 16 }}>
        Demo data — computed from the same fixtures every other section uses. Real numbers
        arrive once the VPS module ships (Streamer Plugin.txt §6).
      </p>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginBottom: 20 }}>
        <StatTile label="Total Devices" value={total} />
        <StatTile label="Online" value={online} />
        <StatTile label="Offline" value={total - online} />
        <StatTile label="Streaming Now" value={streamingNow} />
        <StatTile label="Scheduled Today" value={scheduledToday} />
        <StatTile label="Needs Attention" value={needsAttention} />
        <StatTile label="Expired Credentials" value={expiredCredentials} />
        <StatTile label="Firmware Updates" value={firmwareUpdates} />
      </div>

      <div className="content-grid">
        {DEMO_STREAMER_DEVICES.map((device) => {
          const session = device.activeSessionId
            ? DEMO_STREAMER_SESSIONS.find((entry) => entry.sessionId === device.activeSessionId)
            : undefined;
          const action = primaryActionFor(device);

          return (
            <article className="device-card" key={device.deviceId}>
              <div className="device-card-head">
                <div className="device-icon">{device.streamState === "STREAMING" ? "●" : "○"}</div>
                <div>
                  <p className="device-pid-label">
                    {device.streamState === "STREAMING" ? "Live" : device.onlineStatus === "online" ? "Idle" : "Offline"}
                  </p>
                  <p className="device-pid-code">{device.deviceId}</p>
                </div>
              </div>
              <div>
                <h3>{device.friendlyName}</h3>
                <p>
                  {device.activeDestinationPlatform ? PLATFORM_LABELS[device.activeDestinationPlatform] : "No destination active"}
                </p>
              </div>
              <dl className="summary-grid">
                <div>
                  <dt>Camera</dt>
                  <dd>{device.assignedCameraId ?? "None"}</dd>
                </div>
                <div>
                  <dt>Session Duration</dt>
                  <dd>{session ? formatDuration(session.startTime, session.stoppedAt) : "—"}</dd>
                </div>
                <div>
                  <dt>Next Schedule</dt>
                  <dd>{device.nextScheduleAt ?? "None"}</dd>
                </div>
                <div>
                  <dt>WiFi RSSI</dt>
                  <dd>{device.wifiRssi} dBm</dd>
                </div>
                <div>
                  <dt>Firmware</dt>
                  <dd>{device.firmwareVersion}</dd>
                </div>
                <div>
                  <dt>Last Seen</dt>
                  <dd>{device.lastSeenAt}</dd>
                </div>
              </dl>
              <div className="card-actions">
                <span>{device.onlineStatus === "online" ? "Online" : "Offline"}</span>
                <button className="text-button" onClick={() => onNavigate(action.section)} type="button">
                  {action.label}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
