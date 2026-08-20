import { React } from "../host";
import { DEMO_DEVICE_HEALTH } from "../demoDiagnostics";
import { explainErrorCode } from "../errorCodeExplanations";

interface DiagnosticsPageProps {
  onOpenDevice: (deviceId: string) => void;
}

export function DiagnosticsPage({ onOpenDevice }: DiagnosticsPageProps) {
  return (
    <section>
      <p className="hint-text" style={{ marginBottom: 16 }}>
        Demo data — replace with GET /api/v1/streamer/devices/:deviceId/health once the
        VPS module ships (see VPS/API_CONTRACT.md §6).
      </p>
      <div className="content-grid">
        {DEMO_DEVICE_HEALTH.map((health) => (
          <article className="device-card" key={health.deviceId}>
            <div className="device-card-head">
              <div className="device-icon">{health.lastError ? "!" : "OK"}</div>
              <div>
                <p className="device-pid-label">{health.onlineStatus === "online" ? "Online" : "Offline"}</p>
                <p className="device-pid-code">{health.deviceId}</p>
              </div>
            </div>
            <div>
              <h3>{health.rtspState} / {health.rtmpState}</h3>
              <p>{explainErrorCode(health.lastError)}</p>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>WiFi RSSI</dt>
                <dd>{health.wifiRssi} dBm</dd>
              </div>
              <div>
                <dt>Reconnects</dt>
                <dd>{health.reconnectCount}</dd>
              </div>
            </dl>
            <div className="card-actions">
              <span>{health.timeSynchronized ? "Time synced" : "Time not synced"}</span>
              <button className="text-button" onClick={() => onOpenDevice(health.deviceId)} type="button">
                Open Diagnostics
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
