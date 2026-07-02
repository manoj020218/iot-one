import { AppShell, StatusPill } from "@jenix/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/hooks/useAuth";
import { getHomes } from "../../dashboard/services/dashboardApi";
import {
  ProvisioningProgress
} from "../components/ProvisioningProgress";
import { ProvisioningSuccess } from "../components/ProvisioningSuccess";
import { WifiCredentialForm } from "../components/WifiCredentialForm";
import type {
  BleScanDevice,
  ProvisionedDeviceSummary,
  ProvisioningProgressModel,
  WifiCredentialPayload
} from "../provisioning.types";
import {
  getInitialProvisioningStatus,
  getProvisioningSequence
} from "../services/provisioningStateMachine";
import { BleDeviceScanList } from "./components/BleDeviceScanList";
import { BlePermissionStep } from "./components/BlePermissionStep";
import { useBleScan } from "./hooks/useBleScan";
import { provisionBleDevice } from "./services/bleProvisioningService";

type BleScreen = "permission" | "scan" | "wifi" | "progress" | "success";

function createInitialProgress(): ProvisioningProgressModel {
  return {
    method: "ble",
    statuses: getProvisioningSequence("ble"),
    currentStatus: getInitialProvisioningStatus("ble")
  };
}

export function BleProvisioningPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const scan = useBleScan();
  const [screen, setScreen] = useState<BleScreen>("permission");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<BleScanDevice | null>(null);
  const [progress, setProgress] = useState<ProvisioningProgressModel>(
    createInitialProgress()
  );
  const [summary, setSummary] = useState<ProvisionedDeviceSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    throw new Error("BleProvisioningPage requires an authenticated session");
  }

  const activeSession = session;
  const currentHome = getHomes(activeSession)[0]!;

  async function handleEnableScan() {
    await scan.enable();
    setSearchQuery("");
    setScreen("scan");
  }

  function handleSelectDevice(device: BleScanDevice) {
    setSelectedDevice(device);
    setError(null);
    setScreen("wifi");
  }

  async function handleSubmitWifi(payload: WifiCredentialPayload) {
    if (!selectedDevice) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgress(createInitialProgress());
    setScreen("progress");

    try {
      const provisioned = await provisionBleDevice({
        session: activeSession,
        device: selectedDevice,
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
          : "BLE provisioning failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setScreen("scan");
    setSearchQuery("");
    setSelectedDevice(null);
    setSummary(null);
    setError(null);
    setProgress(createInitialProgress());
  }

  return (
    <AppShell
      eyebrow="Provisioning"
      title="BLE Device Provisioning"
      description="The primary commissioning flow discovers nearby Jenix devices, pushes Wi-Fi credentials, and completes registration into the active HOME."
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="top-bar">
        <div className="top-bar-meta">
          <StatusPill label="Primary Flow" tone="success" />
          <StatusPill
            label={selectedDevice ? selectedDevice.productName : "Waiting for scan"}
            tone="neutral"
          />
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
            onClick={() => navigate("/provisioning/ap")}
            type="button"
          >
            Use AP fallback
          </button>
        </div>
      </section>
      {screen === "permission" ? (
        <BlePermissionStep
          loading={scan.scanning}
          mode={scan.mode}
          onEnable={handleEnableScan}
          supported={scan.supported}
        />
      ) : null}
      {screen === "scan" ? (
        <BleDeviceScanList
          devices={scan.devices}
          error={scan.error}
          onRefresh={scan.refresh}
          onSearchChange={setSearchQuery}
          onSelect={handleSelectDevice}
          scanning={scan.scanning}
          searchQuery={searchQuery}
          selectedDeviceId={selectedDevice?.deviceId}
        />
      ) : null}
      {screen === "wifi" && selectedDevice ? (
        <div className="content-grid">
          <section className="panel">
            <span className="eyebrow">Selected Device</span>
            <h2>{selectedDevice.productName}</h2>
            <p>
              Device <strong>{selectedDevice.deviceId}</strong> will be provisioned
              into <strong>{currentHome.name}</strong>.
            </p>
            <div className="card-actions">
              <button className="text-button" onClick={resetFlow} type="button">
                Choose a different device
              </button>
            </div>
          </section>
          <WifiCredentialForm
            description="Send the installer Wi-Fi credentials over BLE so the device can join the cloud and register its telemetry stream."
            initialSsid="Factory 2.4 GHz"
            loading={submitting}
            onSubmit={handleSubmitWifi}
            submitLabel="Send Wi-Fi over BLE"
            title="Network credentials"
          />
        </div>
      ) : null}
      {screen === "progress" ? (
        <div className="content-grid">
          <ProvisioningProgress
            description="Provisioning is running through BLE handoff, Wi-Fi join, cloud link, and dashboard registration."
            error={error}
            progress={progress}
            title={selectedDevice?.productName ?? "Provisioning device"}
          />
          {error ? (
            <section className="panel">
              <h2>Operator actions</h2>
              <p>
                Retry the Wi-Fi step or switch to the AP path if this browser cannot
                keep the device session stable.
              </p>
              <div className="card-actions">
                <button
                  className="primary-button"
                  onClick={() => setScreen("wifi")}
                  type="button"
                >
                  Retry Wi-Fi step
                </button>
                <button
                  className="text-button"
                  onClick={() => navigate("/provisioning/ap")}
                  type="button"
                >
                  Switch to AP fallback
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
