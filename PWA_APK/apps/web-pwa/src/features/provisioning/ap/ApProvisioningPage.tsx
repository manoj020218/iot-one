import { AppShell, StatusPill } from "@jenix/ui";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/hooks/useAuth";
import { getHomes } from "../../dashboard/services/dashboardApi";
import { deviceCatalog } from "../../devices/deviceCatalog";
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
  const [searchParams] = useSearchParams();
  const targetPid = searchParams.get("pid") ?? undefined;
  const descriptor = getApSetupDescriptor();
  // AP fallback only knows one device's real SoftAP SSID/PID today (Tank
  // Guard, see apProvisioningService.ts's hardcoded apSetupDescriptor) --
  // silently running a different product through it would provision the
  // wrong device. A targeted pid that doesn't match gets a clear "not
  // available yet" screen instead of walking the user through Tank
  // Guard's own hotspot by mistake.
  const targetProduct = targetPid
    ? deviceCatalog.find((entry) => entry.pid === targetPid)
    : undefined;
  const mismatchedTarget = targetPid !== undefined && targetPid !== descriptor.pid;
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
      title="AP Mode Setup"
      description="Connect using the device's own Wi-Fi hotspot to deliver Wi-Fi credentials and cloud setup."
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="top-bar">
        <div className="top-bar-meta">
          <StatusPill label="AP Mode" tone="warning" />
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
            Try Smart Mode
          </button>
        </div>
      </section>
      {mismatchedTarget ? (
        <section className="panel">
          <h2>AP Mode isn&apos;t available yet for {targetProduct?.name ?? "this product"}</h2>
          <p>
            This flow currently only supports {descriptor.productName}&apos;s own hotspot.
            Use Smart Mode instead to set up {targetProduct?.name ?? "this device"}.
          </p>
          <div className="card-actions">
            <button
              className="primary-button"
              onClick={() =>
                navigate(`/provisioning/ble?pid=${encodeURIComponent(targetPid!)}`)
              }
              type="button"
            >
              Use Smart Mode instead
            </button>
          </div>
        </section>
      ) : null}
      {!mismatchedTarget && screen === "instructions" ? (
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
                Retry the Wi-Fi handoff or switch to Smart Mode if hotspot setup is no
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
                  Switch to Smart Mode
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
      {screen === "success" && summary ? (
        <ProvisioningSuccess
          onProvisionAnother={resetFlow}
          onViewDashboard={() => navigate("/home")}
          summary={summary}
        />
      ) : null}
    </AppShell>
  );
}
