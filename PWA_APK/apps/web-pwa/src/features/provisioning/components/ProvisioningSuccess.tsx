import { StatusPill } from "@jenix/ui";

import type { ProvisionedDeviceSummary } from "../provisioning.types";

export interface ProvisioningSuccessProps {
  summary: ProvisionedDeviceSummary;
  onViewDashboard: () => void;
  onProvisionAnother: () => void;
}

export function ProvisioningSuccess({
  summary,
  onViewDashboard,
  onProvisionAnother
}: ProvisioningSuccessProps) {
  return (
    <section className="form-card">
      <div className="provisioning-header-row">
        <div>
          <span className="eyebrow">Ready</span>
          <h2>{summary.productName} is live</h2>
          <p>
            Device <strong>{summary.deviceId}</strong> has been attached to your HOME
            and is ready for dashboard telemetry.
          </p>
        </div>
        <StatusPill label="Provisioned" tone="success" />
      </div>
      <dl className="summary-grid">
        <div>
          <dt>Display Name</dt>
          <dd>{summary.displayName}</dd>
        </div>
        <div>
          <dt>PID</dt>
          <dd>{summary.pid}</dd>
        </div>
        <div>
          <dt>Provisioning ID</dt>
          <dd>{summary.provisioningId}</dd>
        </div>
      </dl>
      <div className="card-actions">
        <button className="primary-button" onClick={onViewDashboard} type="button">
          View Dashboard
        </button>
        <button className="text-button" onClick={onProvisionAnother} type="button">
          Provision another device
        </button>
      </div>
    </section>
  );
}
