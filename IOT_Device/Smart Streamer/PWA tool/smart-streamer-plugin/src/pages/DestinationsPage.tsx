import { React } from "../host";
import { DEMO_STREAMER_DESTINATIONS, PLATFORM_LABELS } from "../demoDestinations";

interface DestinationsPageProps {
  onOpenDestination: (destinationId: string) => void;
  onAddDestination: () => void;
}

function credentialNote(expiry: string | null): string {
  return expiry ? `Expires ${expiry}` : "Persistent";
}

export function DestinationsPage({ onOpenDestination, onAddDestination }: DestinationsPageProps) {
  return (
    <section>
      <div className="scene-section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="hint-text">
            Demo data — replace with GET /api/v1/streamer/destinations once the VPS module
            ships (see VPS/API_CONTRACT.md §3).
          </p>
        </div>
        <button className="primary-button" onClick={onAddDestination} type="button">
          Add Destination
        </button>
      </div>
      <div className="content-grid">
        {DEMO_STREAMER_DESTINATIONS.map((destination) => (
          <article className="device-card" key={destination.destinationId}>
            <div className="device-card-head">
              <div className="device-icon">{PLATFORM_LABELS[destination.platform].slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="device-pid-label">{PLATFORM_LABELS[destination.platform]}</p>
                <p className="device-pid-code">{destination.destinationId}</p>
              </div>
            </div>
            <div>
              <h3>{destination.displayName}</h3>
              <p>{credentialNote(destination.credentialExpiry)}</p>
            </div>
            <div className="card-actions">
              <span>{destination.enabled ? "Enabled" : "Disabled"}</span>
              <button
                className="text-button"
                onClick={() => onOpenDestination(destination.destinationId)}
                type="button"
              >
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
