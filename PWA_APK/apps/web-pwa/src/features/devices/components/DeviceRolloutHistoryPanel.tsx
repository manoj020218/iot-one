import { useState } from "react";

import type { DeviceFirmwareRollout } from "../services/deviceManagementApi";

export interface DeviceRolloutHistoryPanelProps {
  rollouts: DeviceFirmwareRollout[];
  canReplay: boolean;
  onReplay: (requestId: string) => Promise<DeviceFirmwareRollout>;
  onRefresh: () => Promise<void>;
}

function formatRolloutTimestamp(value: string | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString();
}

export function DeviceRolloutHistoryPanel({
  rollouts,
  canReplay,
  onReplay,
  onRefresh
}: DeviceRolloutHistoryPanelProps) {
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="panel device-rollout-panel">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Delivery</span>
          <h2>Firmware Rollout History</h2>
          <p className="hint-text">
            Phase 18 exposes durable OTA delivery status, acknowledgement state,
            and manual replay for failed rollout jobs.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            setError(null);
            void onRefresh()
              .catch((refreshError: unknown) => {
                setError(
                  refreshError instanceof Error
                    ? refreshError.message
                    : "Unable to refresh rollout status."
                );
              })
              .finally(() => {
                setRefreshing(false);
              });
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      {feedback ? <p className="provisioning-note">{feedback}</p> : null}
      {rollouts.length === 0 ? (
        <p className="hint-text">
          No firmware rollout jobs have been queued for this device yet.
        </p>
      ) : (
        <div className="rollout-history-list">
          {rollouts.map((rollout) => (
            <article
              key={rollout.requestId}
              className="rollout-history-card"
              data-status={rollout.status}
            >
              <div className="rollout-history-head">
                <div>
                  <strong>
                    {rollout.targetVersion} on {rollout.channel}
                  </strong>
                  <p className="hint-text">Request {rollout.requestId}</p>
                </div>
                <span className="status-chip">{rollout.status}</span>
              </div>
              <dl className="summary-grid">
                <div>
                  <dt>Requested</dt>
                  <dd>{formatRolloutTimestamp(rollout.requestedAt)}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{rollout.attemptCount}</dd>
                </div>
                <div>
                  <dt>Dispatched</dt>
                  <dd>{formatRolloutTimestamp(rollout.dispatchedAt)}</dd>
                </div>
                <div>
                  <dt>Acknowledged</dt>
                  <dd>{formatRolloutTimestamp(rollout.acknowledgedAt)}</dd>
                </div>
              </dl>
              {rollout.replayedFromRequestId ? (
                <p className="hint-text">
                  Replay of {rollout.replayedFromRequestId}
                </p>
              ) : null}
              {rollout.lastError ? (
                <p className="inline-error">{rollout.lastError}</p>
              ) : null}
              {rollout.status === "failed" && canReplay ? (
                <div className="card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={activeReplayId === rollout.requestId}
                    onClick={() => {
                      setActiveReplayId(rollout.requestId);
                      setError(null);
                      setFeedback(null);
                      void onReplay(rollout.requestId)
                        .then((replayed) => {
                          setFeedback(
                            `Replay queued as ${replayed.requestId} for ${replayed.targetVersion}.`
                          );
                        })
                        .catch((replayError: unknown) => {
                          setError(
                            replayError instanceof Error
                              ? replayError.message
                              : "Unable to replay firmware rollout."
                          );
                        })
                        .finally(() => {
                          setActiveReplayId(null);
                        });
                    }}
                  >
                    {activeReplayId === rollout.requestId
                      ? "Replaying..."
                      : "Replay Failed Rollout"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
