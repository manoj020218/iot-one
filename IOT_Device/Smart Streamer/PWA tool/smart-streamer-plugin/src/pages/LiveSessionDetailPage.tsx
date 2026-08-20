import { React } from "../host";
import { DEMO_STREAMER_SESSIONS, type StreamerSessionSummary } from "../demoSessions";
import { PLATFORM_LABELS } from "../demoDestinations";
import { DetailSection } from "../components/DetailSection";
import { formatDuration } from "../utils/formatDuration";

interface LiveSessionDetailPageProps {
  sessionId: string;
  onBack: () => void;
}

const PLATFORM_LINKS: Record<StreamerSessionSummary["platform"], string> = {
  youtube: "View on YouTube",
  facebook: "View on Facebook",
  instagram: "View on Instagram"
};

export function LiveSessionDetailPage({ sessionId, onBack }: LiveSessionDetailPageProps) {
  const session = DEMO_STREAMER_SESSIONS.find((entry) => entry.sessionId === sessionId);

  if (!session) {
    return (
      <section>
        <BackButton onBack={onBack} />
        <article className="panel">
          <p className="hint-text">Session not found.</p>
        </article>
      </section>
    );
  }

  const isLive = session.status === "STREAMING";

  return (
    <section>
      <BackButton onBack={onBack} />

      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">{PLATFORM_LABELS[session.platform]}</span>
            <h2 style={{ marginBottom: 4 }}>{session.deviceId}</h2>
            <p className="hint-text">
              {session.sessionId} · {isLive ? "Live now" : "Stopped"}
            </p>
          </div>
        </div>
        <dl className="summary-grid">
          <div>
            <dt>Camera</dt>
            <dd>{session.cameraId}</dd>
          </div>
          <div>
            <dt>Trigger Source</dt>
            <dd>{session.triggerSource}</dd>
          </div>
          <div>
            <dt>Video Mode</dt>
            <dd>{session.videoMode}</dd>
          </div>
          <div>
            <dt>Audio Mode</dt>
            <dd>{session.audioMode}</dd>
          </div>
          <div>
            <dt>Connection</dt>
            <dd>{session.connectionStatus}</dd>
          </div>
          <div>
            <dt>Reconnect Count</dt>
            <dd>{session.reconnectCount}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(session.startTime, session.stoppedAt)}</dd>
          </div>
          <div>
            <dt>Bitrate</dt>
            <dd>{session.currentBitrateKbps ? `${session.currentBitrateKbps} kbps` : "Unavailable"}</dd>
          </div>
        </dl>
      </article>

      <DetailSection
        note="Video never renders here — the Smart Streamer control plane does not carry the stream (Streamer Plugin.txt §11). This is not the PWA receiving live video."
        title="Video"
      />

      <article className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Actions</span>
            <h2 style={{ marginBottom: 4 }}>Session Actions</h2>
          </div>
        </div>
        <div className="card-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <button className="text-button" disabled={!isLive} type="button">
            Stop Normally
          </button>
          <button className="text-button" disabled={!isLive} type="button">
            Force Stop
          </button>
          <button className="text-button" disabled={!isLive} type="button">
            Extend Stop Time
          </button>
          <button className="text-button" type="button">
            Open Diagnostics
          </button>
          <button className="text-button" disabled={!isLive} type="button">
            {PLATFORM_LINKS[session.platform]}
          </button>
        </div>
        <p className="hint-text" style={{ marginTop: 8 }}>
          Force Stop requires smart_streamer.stream.force_stop and is always audit-logged
          (Streamer Plugin.txt §17, §27). Wired to POST
          /api/v1/devices/:deviceId/streamer/sessions/... once the VPS module ships.
        </p>
      </article>
    </section>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className="text-button" onClick={onBack} style={{ marginBottom: 12 }} type="button">
      ← Back to Live Sessions
    </button>
  );
}
