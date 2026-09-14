import type { ProvisioningStatus } from "@jenix/shared";
import { StatusPill } from "@jenix/ui";
import { FiCheck, FiLoader } from "react-icons/fi";

import type { ProvisioningProgressModel } from "../provisioning.types";

const statusCopy: Record<ProvisioningStatus, string> = {
  BLE_CONNECTED: "Device found and paired",
  WIFI_SENT: "Wi-Fi credentials delivered",
  DEVICE_CONNECTING_WIFI: "Device is joining the Wi-Fi network",
  DEVICE_CONNECTING_CLOUD: "Device is linking to Jenix Cloud",
  MQTT_CONNECTED: "MQTT session established",
  DEVICE_REGISTERED: "Device saved to your home",
  SUCCESS: "Provisioning completed",
  FAILED: "Provisioning failed"
};

export interface ProvisioningProgressProps {
  progress: ProvisioningProgressModel;
  title: string;
  description: string;
  error?: string | null | undefined;
  /**
   * "classic" (default, omit the prop) renders exactly the original markup
   * -- BLE's call site is untouched by this. "ap" opts into the AP-mode
   * redesign's checklist look (`.apv2-*` classes); only
   * ApProvisioningProgress.tsx passes it.
   */
  appearance?: "classic" | "ap";
}

function getStepState(
  statuses: ProvisioningStatus[],
  currentStatus: ProvisioningStatus,
  status: ProvisioningStatus
) {
  const currentIndex = statuses.indexOf(currentStatus);
  const stepIndex = statuses.indexOf(status);

  if (stepIndex < currentIndex) {
    return "complete";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "pending";
}

export function ProvisioningProgress({
  progress,
  title,
  description,
  error,
  appearance = "classic"
}: ProvisioningProgressProps) {
  if (appearance === "ap") {
    return (
      <section className="form-card apv2-panel">
        <span className="eyebrow">Step 3 of 3</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <ul className="apv2-checklist">
          {progress.statuses.map((status) => {
            const state = getStepState(progress.statuses, progress.currentStatus, status);
            return (
              <li data-state={state} key={status}>
                <span className="apv2-checklist-mark">
                  {state === "complete" ? (
                    <FiCheck aria-hidden="true" />
                  ) : state === "current" ? (
                    <FiLoader aria-hidden="true" className="apv2-spinning" />
                  ) : null}
                </span>
                <span className="apv2-checklist-text">
                  <strong>{statusCopy[status]}</strong>
                  <span className="apv2-checklist-code">{status}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {error ? <p className="inline-error">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="form-card">
      <div className="provisioning-header-row">
        <div>
          <span className="eyebrow">Provisioning Status</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusPill
          label={progress.method === "ble" ? "Smart Mode" : "AP Mode"}
          tone={error ? "warning" : "success"}
        />
      </div>
      <ol className="progress-list">
        {progress.statuses.map((status) => (
          <li
            key={status}
            className="progress-step"
            data-state={getStepState(
              progress.statuses,
              progress.currentStatus,
              status
            )}
          >
            <strong>{statusCopy[status]}</strong>
            <span>{status}</span>
          </li>
        ))}
      </ol>
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
