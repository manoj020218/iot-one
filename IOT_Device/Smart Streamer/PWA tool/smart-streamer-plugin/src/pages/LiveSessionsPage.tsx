import { React } from "../host";
import { DEMO_STREAMER_SESSIONS } from "../demoSessions";
import { PLATFORM_LABELS } from "../demoDestinations";

interface LiveSessionsPageProps {
  onOpenSession: (sessionId: string) => void;
}

export function LiveSessionsPage({ onOpenSession }: LiveSessionsPageProps) {
  return (
    <section>
      <p className="hint-text" style={{ marginBottom: 16 }}>
        Demo data — replace with GET /api/v1/streamer/sessions once the VPS module ships.
        Polled every 10–30s while this page is open (Streamer Plugin.txt §25); never
        embeds video.
      </p>
      <div className="content-grid">
        {DEMO_STREAMER_SESSIONS.map((session) => (
          <article className="device-card" key={session.sessionId}>
            <div className="device-card-head">
              <div className="device-icon">{session.status === "STREAMING" ? "●" : "○"}</div>
              <div>
                <p className="device-pid-label">{PLATFORM_LABELS[session.platform]}</p>
                <p className="device-pid-code">{session.sessionId}</p>
              </div>
            </div>
            <div>
              <h3>{session.deviceId}</h3>
              <p>{session.status === "STREAMING" ? "Live now" : `Stopped ${session.stoppedAt}`}</p>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>Trigger</dt>
                <dd>{session.triggerSource}</dd>
              </div>
              <div>
                <dt>Reconnects</dt>
                <dd>{session.reconnectCount}</dd>
              </div>
            </dl>
            <div className="card-actions">
              <span>{session.connectionStatus}</span>
              <button className="text-button" onClick={() => onOpenSession(session.sessionId)} type="button">
                View
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
