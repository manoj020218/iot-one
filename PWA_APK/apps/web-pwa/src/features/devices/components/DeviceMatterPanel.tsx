import { useState } from "react";

import type {
  HomeAccessRole,
  MatterDeviceStatus,
  MatterPlaceholderActionResult
} from "@jenix/shared";

export interface DeviceMatterPanelProps {
  status: MatterDeviceStatus;
  homeRole: HomeAccessRole;
  onCommission: () => Promise<MatterPlaceholderActionResult>;
  onBridgeSync: () => Promise<MatterPlaceholderActionResult>;
}

function canManageMatter(role: HomeAccessRole): boolean {
  return role === "owner" || role === "admin";
}

function formatState(value: string): string {
  return value.replaceAll("_", " ");
}

export function DeviceMatterPanel({
  status,
  homeRole,
  onCommission,
  onBridgeSync
}: DeviceMatterPanelProps) {
  const [submittingAction, setSubmittingAction] = useState<
    "commission" | "bridge_sync" | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageMatter(homeRole);
  const canCommission =
    status.readiness === "ready_to_commission" || status.readiness === "bridge_ready";
  const canBridgeSync =
    status.bridgeState === "gateway_ready" ||
    status.bridgeState === "child_waiting_for_gateway" ||
    status.bridgeState === "sync_requested";

  return (
    <section className="panel matter-panel">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Matter</span>
          <h2>Matter Readiness</h2>
          <p className="hint-text">
            Phase 11 models Matter mapping, readiness, bridge state, and operator
            placeholders before live commissioner and bridge transport are introduced.
          </p>
        </div>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>Mode</dt>
          <dd>{formatState(status.mode)}</dd>
        </div>
        <div>
          <dt>Readiness</dt>
          <dd>{formatState(status.readiness)}</dd>
        </div>
        <div>
          <dt>Commissioning</dt>
          <dd>{formatState(status.commissioningState)}</dd>
        </div>
        <div>
          <dt>Bridge</dt>
          <dd>{formatState(status.bridgeState)}</dd>
        </div>
        <div>
          <dt>Device Type</dt>
          <dd>{status.mapping.deviceType ?? "Not mapped"}</dd>
        </div>
        <div>
          <dt>Vendor / Product</dt>
          <dd>
            {status.mapping.vendorId ?? "Unknown"} / {status.mapping.productId ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Clusters</dt>
          <dd>
            {status.mapping.clusters.length
              ? status.mapping.clusters.join(", ")
              : "Not mapped"}
          </dd>
        </div>
        <div>
          <dt>Endpoints</dt>
          <dd>{status.mapping.endpoints.length}</dd>
        </div>
        <div>
          <dt>Certification</dt>
          <dd>{status.mapping.certificationStatus ?? "Not mapped"}</dd>
        </div>
        <div>
          <dt>Bridge Support</dt>
          <dd>{status.mapping.bridgeSupported ? "Enabled" : "Disabled"}</dd>
        </div>
      </dl>
      {status.notes.length ? (
        <ul className="instruction-list">
          {status.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {status.lastCommissioningAttemptAt ? (
        <p className="hint-text">
          Last commissioning placeholder: {status.lastCommissioningAttemptAt}
        </p>
      ) : null}
      {status.lastBridgeSyncAt ? (
        <p className="hint-text">Last bridge sync placeholder: {status.lastBridgeSyncAt}</p>
      ) : null}
      {!canManage ? (
        <p className="inline-error">
          Only owner or admin access can trigger Matter commissioning or bridge sync.
        </p>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
      {feedback ? <p className="provisioning-note">{feedback}</p> : null}
      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={submittingAction !== null || !canManage || !canCommission}
          onClick={() => {
            setSubmittingAction("commission");
            setError(null);
            setFeedback(null);
            void onCommission()
              .then((result) => {
                setFeedback(result.message);
              })
              .catch((requestError: unknown) => {
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : "Matter commissioning failed."
                );
              })
              .finally(() => {
                setSubmittingAction(null);
              });
          }}
        >
          {submittingAction === "commission"
            ? "Starting..."
            : "Start Matter Commissioning"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={submittingAction !== null || !canManage || !canBridgeSync}
          onClick={() => {
            setSubmittingAction("bridge_sync");
            setError(null);
            setFeedback(null);
            void onBridgeSync()
              .then((result) => {
                setFeedback(result.message);
              })
              .catch((requestError: unknown) => {
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : "Matter bridge sync failed."
                );
              })
              .finally(() => {
                setSubmittingAction(null);
              });
          }}
        >
          {submittingAction === "bridge_sync" ? "Syncing..." : "Run Bridge Sync"}
        </button>
      </div>
    </section>
  );
}
