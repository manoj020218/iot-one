import { useState } from "react";

import type { SceneAction, SceneActionDispatchRecord } from "@jenix/shared";

export interface SceneDispatchHistoryPanelProps {
  dispatches: SceneActionDispatchRecord[];
  canReplay: boolean;
  onReplay: (jobId: string) => Promise<SceneActionDispatchRecord>;
  onRefresh: () => Promise<void>;
}

function formatDispatchTimestamp(value: string | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString();
}

function describeAction(action: SceneAction) {
  if (action.type === "notification") {
    return action.message ? `Notification: ${action.message}` : "Notification";
  }

  if (action.command && action.deviceId) {
    return `${action.command} on ${action.deviceId}`;
  }

  if (action.command) {
    return action.command;
  }

  if (action.deviceId) {
    return `Device command for ${action.deviceId}`;
  }

  return "Device command";
}

export function SceneDispatchHistoryPanel({
  dispatches,
  canReplay,
  onReplay,
  onRefresh
}: SceneDispatchHistoryPanelProps) {
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="panel scene-dispatch-panel">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Dispatch Recovery</span>
          <h2>Scene Dispatch History</h2>
          <p className="hint-text">
            Phase 19 exposes failed scene deliveries, action-level dispatch state,
            and replay controls directly on the scene operations surface.
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
                    : "Unable to refresh scene dispatch history."
                );
              })
              .finally(() => {
                setRefreshing(false);
              });
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh Dispatches"}
        </button>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      {feedback ? <p className="provisioning-note">{feedback}</p> : null}
      {dispatches.length === 0 ? (
        <p className="hint-text">
          No scene dispatch jobs have been recorded for this scene yet.
        </p>
      ) : (
        <div className="rollout-history-list">
          {dispatches.map((dispatch) => (
            <article
              key={dispatch.jobId}
              className="rollout-history-card"
              data-status={dispatch.status}
            >
              <div className="rollout-history-head">
                <div>
                  <strong>{describeAction(dispatch.action)}</strong>
                  <p className="hint-text">Dispatch {dispatch.jobId}</p>
                </div>
                <span className="status-chip" data-status={dispatch.status}>
                  {dispatch.status}
                </span>
              </div>
              <dl className="summary-grid">
                <div>
                  <dt>Source</dt>
                  <dd>{dispatch.source.replace("_", " ")}</dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>{formatDispatchTimestamp(dispatch.requestedAt)}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{dispatch.attemptCount}</dd>
                </div>
                <div>
                  <dt>Dispatched</dt>
                  <dd>{formatDispatchTimestamp(dispatch.dispatchedAt)}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{formatDispatchTimestamp(dispatch.completedAt)}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{formatDispatchTimestamp(dispatch.failedAt)}</dd>
                </div>
              </dl>
              {dispatch.replayedFromJobId ? (
                <p className="hint-text">Replay of {dispatch.replayedFromJobId}</p>
              ) : null}
              {dispatch.lastError ? <p className="inline-error">{dispatch.lastError}</p> : null}
              {dispatch.status === "failed" && canReplay ? (
                <div className="card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={activeReplayId === dispatch.jobId}
                    onClick={() => {
                      setActiveReplayId(dispatch.jobId);
                      setError(null);
                      setFeedback(null);
                      void onReplay(dispatch.jobId)
                        .then((replayed) => {
                          setFeedback(`Replay queued as ${replayed.jobId}.`);
                        })
                        .catch((replayError: unknown) => {
                          setError(
                            replayError instanceof Error
                              ? replayError.message
                              : "Unable to replay scene dispatch."
                          );
                        })
                        .finally(() => {
                          setActiveReplayId(null);
                        });
                    }}
                  >
                    {activeReplayId === dispatch.jobId
                      ? "Replaying..."
                      : "Replay Failed Dispatch"}
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
