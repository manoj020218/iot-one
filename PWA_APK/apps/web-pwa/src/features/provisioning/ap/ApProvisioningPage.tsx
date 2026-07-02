import { AppShell, StatusPill } from "@jenix/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/hooks/useAuth";
import { getHomes } from "../../dashboard/services/dashboardApi";
import { ProvisioningSuccess } from "../components/ProvisioningSuccess";
import type {
  ProvisionedDeviceSummary,
  ProvisioningProgressModel,
  WifiCredentialPayload
} from "../provisioning.types";
import {
  getInitialProvisioningStatus,
  getProvisioningSequence
} from "../services/provisioningStateMachine";
import { ApInstructionStep } from "./components/ApInstructionStep";
import { ApProvisioningProgress } from "./components/ApProvisioningProgress";
import { ApWifiForm } from "./components/ApWifiForm";
import {
  getApSetupDescriptor,
  provisionApDevice
} from "./services/apProvisioningService";

type ApScreen = "instructions" | "wifi" | "progress" | "success";

function createInitialProgress(): ProvisioningProgressModel {
  return {
    method: "ap",
    statuses: getProvisioningSequence("ap"),
    currentStatus: getInitialProvisioningStatus("ap")
  };
}

export function ApProvisioningPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const descriptor = getApSetupDescriptor();
  const [screen, setScreen] = useState<ApScreen>("instructions");
  const [summary, setSummary] = useState<ProvisionedDeviceSummary | null>(null);
  const [progress, setProgress] = useState<ProvisioningProgressModel>(
    createInitialProgress()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    throw new Error("ApProvisioningPage requires an authenticated session");
  }

  const activeSession = session;
  const currentHome = getHomes(activeSession)[0]!;

  async function handleSubmitWifi(payload: WifiCredentialPayload) {
    setSubmitting(true);
    setError(null);
    setProgress(createInitialProgress());
    setScreen("progress");

    try {
      const provisioned = await provisionApDevice({
        session: activeSession,
        wifi: payload,
        onStatusChange(status) {
          setProgress((current) => ({
            ...current,
            currentStatus: status
          }));
        }
      });

      setSummary(provisioned);
      setScreen("success");
    } catch (provisionError) {
      setError(
        provisionError instanceof Error
          ? provisionError.message
          : "AP provisioning failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setSummary(null);
    setProgress(createInitialProgress());
    setError(null);
    setScreen("instructions");
  }

  return (
    <AppShell
      eyebrow="Provisioning"
      title="AP Fallback Provisioning"
      description="The fallback flow keeps installers moving when Bluetooth is not viable, using the device hotspot to deliver Wi-Fi and cloud onboarding."
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="top-bar">
        <div className="top-bar-meta">
          <StatusPill label="Fallback Flow" tone="warning" />
          <StatusPill label={descriptor.apSsid} tone="neutral" />
        </div>
        <div className="top-bar-meta">
          <button
            className="text-button"
            onClick={() => navigate("/provisioning")}
            type="button"
          >
            Change method
          </button>
          <button
            className="text-button"
            onClick={() => navigate("/provisioning/ble")}
            type="button"
          >
            Return to BLE
          </button>
        </div>
      </section>
      {screen === "instructions" ? (
        <ApInstructionStep
          descriptor={descriptor}
          onContinue={() => setScreen("wifi")}
        />
      ) : null}
      {screen === "wifi" ? (
        <div className="content-grid">
          <section className="panel">
            <span className="eyebrow">Hotspot Context</span>
            <h2>{descriptor.productName}</h2>
            <p>
              Once credentials are sent from <strong>{descriptor.apSsid}</strong>, the
              device will join <strong>{currentHome.name}</strong> in the cloud.
            </p>
            <div className="card-actions">
              <button
                className="text-button"
                onClick={() => setScreen("instructions")}
                type="button"
              >
                Review hotspot steps
              </button>
            </div>
          </section>
          <ApWifiForm
            descriptor={descriptor}
            loading={submitting}
            onSubmit={handleSubmitWifi}
          />
        </div>
      ) : null}
      {screen === "progress" ? (
        <div className="content-grid">
          <ApProvisioningProgress
            descriptor={descriptor}
            error={error}
            progress={progress}
          />
          {error ? (
            <section className="panel">
              <h2>Operator actions</h2>
              <p>
                Retry the Wi-Fi handoff or switch back to BLE if hotspot setup is no
                longer required.
              </p>
              <div className="card-actions">
                <button
                  className="primary-button"
                  onClick={() => setScreen("wifi")}
                  type="button"
                >
                  Retry Wi-Fi handoff
                </button>
                <button
                  className="text-button"
                  onClick={() => navigate("/provisioning/ble")}
                  type="button"
                >
                  Switch to BLE
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
      {screen === "success" && summary ? (
        <ProvisioningSuccess
          onProvisionAnother={resetFlow}
          onViewDashboard={() => navigate("/dashboard")}
          summary={summary}
        />
      ) : null}
    </AppShell>
  );
}
