import type { ProvisioningStatus } from "@jenix/shared";
import { StatusPill } from "@jenix/ui";

import type { ProvisioningProgressModel } from "../provisioning.types";

const statusCopy: Record<ProvisioningStatus, string> = {
  BLE_CONNECTED: "Device is paired over BLE",
  WIFI_SENT: "Wi-Fi credentials delivered",
  DEVICE_CONNECTING_WIFI: "Device is joining the Wi-Fi network",
  DEVICE_CONNECTING_CLOUD: "Device is linking to Jenix Cloud",
  MQTT_CONNECTED: "MQTT session established",
  DEVICE_REGISTERED: "Device saved to your HOME",
  SUCCESS: "Provisioning completed",
  FAILED: "Provisioning failed"
};

export interface ProvisioningProgressProps {
  progress: ProvisioningProgressModel;
  title: string;
  description: string;
  error?: string | null | undefined;
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
  error
}: ProvisioningProgressProps) {
  return (
    <section className="form-card">
      <div className="provisioning-header-row">
        <div>
          <span className="eyebrow">Provisioning Status</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusPill
          label={progress.method === "ble" ? "BLE Flow" : "AP Flow"}
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
