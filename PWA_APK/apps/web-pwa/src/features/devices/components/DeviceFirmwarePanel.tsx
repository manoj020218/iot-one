import { useEffect, useState } from "react";

import {
  type DeviceFirmwarePlan,
  type RequestFirmwareUpdateInput
} from "../services/deviceManagementApi";

export interface DeviceFirmwarePanelProps {
  plan: DeviceFirmwarePlan;
  onRequest: (
    input: RequestFirmwareUpdateInput
  ) => Promise<{
    status: "queued" | "up_to_date";
    targetVersion: string;
    channel: "stable" | "beta";
  }>;
}

export function DeviceFirmwarePanel({
  plan,
  onRequest
}: DeviceFirmwarePanelProps) {
  const [channel, setChannel] = useState<"stable" | "beta">(plan.recommendedChannel);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChannel(plan.recommendedChannel);
  }, [plan.recommendedChannel]);

  const targetVersion =
    channel === "beta" ? plan.betaVersion : plan.stableVersion;

  return (
    <section className="panel firmware-panel">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Firmware</span>
          <h2>Firmware Update Panel</h2>
          <p className="hint-text">
            Phase 10 resolves published OTA releases by PID and hardware revision
            before a firmware request is queued.
          </p>
        </div>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>Current</dt>
          <dd>{plan.currentVersion ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Stable</dt>
          <dd>{plan.stableVersion ?? plan.stableReason ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Beta</dt>
          <dd>{plan.betaVersion ?? plan.betaReason ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Recommended</dt>
          <dd>{plan.recommendedChannel}</dd>
        </div>
      </dl>
      <div className="scene-form-grid">
        <label className="field">
          <span>Release Channel</span>
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as "stable" | "beta")
            }
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
          </select>
        </label>
        <label className="field">
          <span>Target Version</span>
          <input readOnly value={targetVersion ?? "No release available"} />
        </label>
      </div>
      {plan.blockedReason ? <p className="inline-error">{plan.blockedReason}</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}
      {feedback ? <p className="provisioning-note">{feedback}</p> : null}
      <div className="card-actions">
        <button
          className="primary-button"
          type="button"
          disabled={submitting || !plan.canRequest || !targetVersion}
          onClick={() => {
            setSubmitting(true);
            setError(null);
            setFeedback(null);
            void onRequest({
              channel
            })
              .then((result) => {
                setFeedback(
                  result.status === "up_to_date"
                    ? `Device is already on ${result.targetVersion}.`
                    : `Firmware request queued for ${result.targetVersion} on the ${result.channel} channel.`
                );
              })
              .catch((requestError: unknown) => {
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : "Firmware request failed."
                );
              })
              .finally(() => {
                setSubmitting(false);
              });
          }}
        >
          {submitting ? "Requesting..." : "Request Firmware Update"}
        </button>
      </div>
    </section>
  );
}
