import { StatusPill } from "@jenix/ui";
import { FiCheck } from "react-icons/fi";

import type { ProvisionedDeviceSummary } from "../provisioning.types";

export interface ProvisioningSuccessProps {
  summary: ProvisionedDeviceSummary;
  onViewDashboard: () => void;
  onProvisionAnother: () => void;
  /**
   * "classic" (default, omit the prop) renders exactly the original markup
   * -- BLE's call site is untouched by this. "ap" opts into the AP-mode
   * redesign's look (`.apv2-*` classes); only ApProvisioningPage.tsx passes
   * it.
   */
  appearance?: "classic" | "ap";
}

export function ProvisioningSuccess({
  summary,
  onViewDashboard,
  onProvisionAnother,
  appearance = "classic"
}: ProvisioningSuccessProps) {
  if (appearance === "ap") {
    return (
      <section className="form-card apv2-panel">
        <div className="apv2-hero-icon apv2-hero-success">
          <FiCheck aria-hidden="true" />
        </div>
        <span className="eyebrow">Added to My Home</span>
        <h2>{summary.productName} is online</h2>
        <p>It&apos;ll show up on the Home tab within a few seconds.</p>
        <div className="apv2-summary-card">
          <div className="apv2-summary-row">
            <span>Display name</span>
            <strong>{summary.displayName}</strong>
          </div>
          <div className="apv2-summary-row">
            <span>Device ID</span>
            <strong className="mono">{summary.deviceId}</strong>
          </div>
          <div className="apv2-summary-row">
            <span>PID</span>
            <strong className="mono">{summary.pid}</strong>
          </div>
        </div>
        <div className="apv2-btn-row">
          <button className="apv2-btn apv2-btn-primary" onClick={onViewDashboard} type="button">
            Go to dashboard
          </button>
          <button className="apv2-btn apv2-btn-ghost" onClick={onProvisionAnother} type="button">
            Add another device
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="form-card">
      <div className="provisioning-header-row">
        <div>
          <span className="eyebrow">Ready</span>
          <h2>{summary.productName} is live</h2>
          <p>
            Device <strong>{summary.deviceId}</strong> has been added to your home
            and is ready for the dashboard.
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
