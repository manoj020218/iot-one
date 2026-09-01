import type { TokenDispenserState } from "../types";

interface Props {
  state: TokenDispenserState;
}

function rssiLabel(r: number) {
  if (r >= -60) return "Strong";
  if (r >= -70) return "Good";
  if (r >= -80) return "Weak";
  return "Poor";
}

function rssiColor(r: number) {
  if (r >= -60) return "#16a34a";
  if (r >= -70) return "#0f766e";
  if (r >= -80) return "#d97706";
  return "#dc2626";
}

function uptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Chip({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span
      className="status-chip"
      style={{
        background: ok ? "rgba(220,252,231,0.9)" : "rgba(254,226,226,0.9)",
        color: ok ? "#16a34a" : "#dc2626"
      }}
    >
      {ok ? on : off}
    </span>
  );
}

export function DeviceHealthCard({ state }: Props) {
  return (
    <article className="scene-card">
      <p className="scene-card-kicker">Device Health</p>
      <h3 style={{ margin: 0 }}>Connectivity</h3>

      <dl className="summary-grid">
        <div>
          <dt>WiFi RSSI</dt>
          <dd style={{ color: rssiColor(state.wifiRssi) }}>
            {state.wifiRssi} dBm — {rssiLabel(state.wifiRssi)}
          </dd>
        </div>
        <div>
          <dt>MQTT</dt>
          <dd><Chip ok={state.mqttStatus === "CONNECTED"} on="Connected" off="Disconnected" /></dd>
        </div>
        <div>
          <dt>HTTP Fallback</dt>
          <dd><Chip ok={state.httpFallback} on="Active" off="Not in use" /></dd>
        </div>
        <div>
          <dt>ESP-NOW</dt>
          <dd><Chip ok={state.espNowStatus === "ACTIVE"} on="Active" off="Inactive" /></dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd>{uptime(state.uptimeSec)}</dd>
        </div>
        <div>
          <dt>Firmware</dt>
          <dd>{state.firmwareVersion}</dd>
        </div>
      </dl>
    </article>
  );
}
