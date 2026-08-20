import { React } from "../host";
import { DEMO_DEVICE_HEALTH } from "../demoDiagnostics";
import { explainErrorCode } from "../errorCodeExplanations";

interface DeviceDiagnosticsPageProps {
  deviceId: string;
  onBack: () => void;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
}

export function DeviceDiagnosticsPage({ deviceId, onBack }: DeviceDiagnosticsPageProps) {
  const health = DEMO_DEVICE_HEALTH.find((entry) => entry.deviceId === deviceId);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (!health) {
    return (
      <section>
        <BackButton onBack={onBack} />
        <article className="panel">
          <p className="hint-text">Device not found.</p>
        </article>
      </section>
    );
  }

  return (
    <section>
      <BackButton onBack={onBack} />

      {health.lastError ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <span className="eyebrow">Last Error</span>
          <h2 style={{ marginBottom: 4 }}>{explainErrorCode(health.lastError)}</h2>
          <p className="hint-text">Technical code: {health.lastError}</p>
        </article>
      ) : null}

      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Connectivity</span>
            <h2 style={{ marginBottom: 4 }}>{health.deviceId}</h2>
            <p className="hint-text">Last seen {health.lastSeenAt}</p>
          </div>
        </div>
        <dl className="summary-grid">
          <div>
            <dt>Status</dt>
            <dd>{health.onlineStatus}</dd>
          </div>
          <div>
            <dt>Uptime</dt>
            <dd>{formatUptime(health.uptimeSeconds)}</dd>
          </div>
          <div>
            <dt>WiFi RSSI</dt>
            <dd>{health.wifiRssi} dBm</dd>
          </div>
          <div>
            <dt>IP Address</dt>
            <dd>{health.ipAddress}</dd>
          </div>
          <div>
            <dt>Time Sync</dt>
            <dd>{health.timeSynchronized ? "Synchronized" : "Not synchronized"}</dd>
          </div>
          <div>
            <dt>Reconnect Count</dt>
            <dd>{health.reconnectCount}</dd>
          </div>
        </dl>
      </article>

      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Camera &amp; Streaming</span>
          </div>
        </div>
        <dl className="summary-grid">
          <div>
            <dt>Camera Connection</dt>
            <dd>{health.cameraConnection}</dd>
          </div>
          <div>
            <dt>RTSP State</dt>
            <dd>{health.rtspState}</dd>
          </div>
          <div>
            <dt>RTMP State</dt>
            <dd>{health.rtmpState}</dd>
          </div>
          <div>
            <dt>Current Session</dt>
            <dd>{health.currentSessionId ?? "None"}</dd>
          </div>
        </dl>
      </article>

      <article className="panel">
        <div className="card-actions">
          <button className="text-button" onClick={() => setShowAdvanced((current) => !current)} type="button">
            {showAdvanced ? "Hide Advanced Details" : "Show Advanced Details"}
          </button>
          <button className="text-button" disabled type="button">
            Download Diagnostic Report
          </button>
        </div>
        {showAdvanced ? (
          <dl className="summary-grid" style={{ marginTop: 12 }}>
            <div>
              <dt>Reset Reason</dt>
              <dd>{health.resetReason}</dd>
            </div>
            <div>
              <dt>Free Heap</dt>
              <dd>{health.freeHeap.toLocaleString()} B</dd>
            </div>
            <div>
              <dt>Min Free Heap</dt>
              <dd>{health.minFreeHeap.toLocaleString()} B</dd>
            </div>
            <div>
              <dt>Largest Free Block</dt>
              <dd>{health.largestFreeBlock.toLocaleString()} B</dd>
            </div>
            <div>
              <dt>PSRAM</dt>
              <dd>{health.psramStatus}</dd>
            </div>
            <div>
              <dt>Firmware / Hardware</dt>
              <dd>{health.firmwareVersion} / {health.hardwareRevision}</dd>
            </div>
          </dl>
        ) : null}
        <p className="hint-text" style={{ marginTop: 12 }}>
          The export never includes camera password, stream key, device signing key, WiFi
          password, or a complete authenticated RTSP URL (Streamer Plugin.txt §15).
        </p>
      </article>
    </section>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className="text-button" onClick={onBack} style={{ marginBottom: 12 }} type="button">
      ← Back to Diagnostics
    </button>
  );
}
