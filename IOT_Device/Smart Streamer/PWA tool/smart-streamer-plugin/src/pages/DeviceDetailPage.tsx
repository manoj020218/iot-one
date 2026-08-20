import { React } from "../host";
import { DEMO_STREAMER_DEVICES } from "../demoDevices";
import { DetailSection } from "../components/DetailSection";

interface DeviceDetailPageProps {
  deviceId: string;
  onBack: () => void;
}

const DISABLED_ACTIONS = [
  "Start Stream",
  "Stop Stream",
  "Restart Pipeline",
  "Test Camera",
  "Open Diagnostics"
];

export function DeviceDetailPage({ deviceId, onBack }: DeviceDetailPageProps) {
  const device = DEMO_STREAMER_DEVICES.find((entry) => entry.deviceId === deviceId);

  if (!device) {
    return (
      <section>
        <BackButton onBack={onBack} />
        <article className="panel">
          <p className="hint-text">Device not found.</p>
        </article>
      </section>
    );
  }

  const streamNote = device.activeSessionId
    ? `Session ${device.activeSessionId} live on ${device.activeDestinationPlatform}.`
    : "No active session.";

  return (
    <section>
      <BackButton onBack={onBack} />

      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Device Summary</span>
            <h2 style={{ marginBottom: 4 }}>{device.friendlyName}</h2>
            <p className="hint-text">
              {device.deviceId} · Firmware {device.firmwareVersion}
            </p>
          </div>
        </div>
        <dl className="summary-grid">
          <div>
            <dt>Status</dt>
            <dd>{device.onlineStatus}</dd>
          </div>
          <div>
            <dt>Stream State</dt>
            <dd>{device.streamState}</dd>
          </div>
          <div>
            <dt>WiFi RSSI</dt>
            <dd>{device.wifiRssi} dBm</dd>
          </div>
          <div>
            <dt>Last Seen</dt>
            <dd>{device.lastSeenAt}</dd>
          </div>
        </dl>
      </article>

      <DetailSection note={streamNote} title="Current Stream" />
      <DetailSection
        note={device.assignedCameraId ?? "No camera assigned yet."}
        title="Assigned Camera"
      />
      <DetailSection
        note="YouTube, Facebook, and Instagram profiles assignable once Destinations ships."
        title="Available Destinations"
      />
      <DetailSection
        note={device.nextScheduleAt ?? "No upcoming schedule."}
        title="Next Schedule"
      />
      <DetailSection note={`RSSI ${device.wifiRssi} dBm.`} title="Network Status" />
      <DetailSection
        note="Free heap, reconnect count, RTSP/RTMP state land with the Diagnostics API."
        title="Health"
      />
      <DetailSection
        note="Claim, camera/destination changes, and stream events land with the platform audit log."
        title="Recent Activity"
      />

      <article className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Actions</span>
            <h2 style={{ marginBottom: 4 }}>Device Actions</h2>
          </div>
        </div>
        <div className="card-actions">
          {DISABLED_ACTIONS.map((label) => (
            <button className="text-button" disabled key={label} type="button">
              {label}
            </button>
          ))}
        </div>
        <p className="hint-text" style={{ marginTop: 8 }}>
          Wired to POST /api/v1/devices/:deviceId/streamer/... once the VPS module ships
          (see VPS/API_CONTRACT.md §1 and §5).
        </p>
      </article>
    </section>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className="text-button" onClick={onBack} style={{ marginBottom: 12 }} type="button">
      ← Back to Devices
    </button>
  );
}
