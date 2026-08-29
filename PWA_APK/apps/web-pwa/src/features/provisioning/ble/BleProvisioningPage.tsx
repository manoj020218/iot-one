import { AppShell, StatusPill } from "@jenix/ui";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/hooks/useAuth";
import { getHomes } from "../../dashboard/services/dashboardApi";
import { deviceCatalog } from "../../devices/deviceCatalog";
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
import { BleRadarScanner } from "./components/BleRadarScanner";
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
  const [searchParams] = useSearchParams();
  const targetPid = searchParams.get("pid") ?? undefined;
  const targetProduct = targetPid
    ? deviceCatalog.find((entry) => entry.pid === targetPid)
    : undefined;
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
  const scannedDevices = targetPid
    ? scan.devices.filter((device) => device.pid === targetPid)
    : scan.devices;

  function routeFor(route: string) {
    return targetPid ? `${route}?pid=${encodeURIComponent(targetPid)}` : route;
  }

  async function handleEnableScan() {
    await scan.enable();
    setSearchQuery("");
    setScreen("scan");
  }

  useEffect(() => {
    void handleEnableScan();
  }, []);

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
      title={targetProduct ? `Find your ${targetProduct.name}` : "BLE Device Provisioning"}
      description={
        targetProduct
          ? `Scanning for a nearby ${targetProduct.name} over Bluetooth to connect it to this home's Wi-Fi.`
          : "Discover nearby Jenix devices over Bluetooth and connect them to this home's Wi-Fi."
      }
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
            onClick={() => navigate(routeFor("/provisioning"))}
            type="button"
          >
            Change method
          </button>
          <button
            className="text-button"
            onClick={() => navigate(routeFor("/provisioning/ap"))}
            type="button"
          >
            Use AP fallback
          </button>
        </div>
      </section>
      {screen === "permission" ? (
        <BleRadarScanner
          bluetoothEnabled={scan.bluetoothEnabled}
          permissionDenied={scan.permissionDenied}
          scanning={scan.scanning}
        />
      ) : null}
      {screen === "scan" ? (
        <BleDeviceScanList
          devices={scannedDevices}
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
            requireProofOfPossession
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
              <h2>What you can do</h2>
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
                  onClick={() => navigate(routeFor("/provisioning/ap"))}
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
          onViewDashboard={() => navigate("/home")}
          summary={summary}
        />
      ) : null}
    </AppShell>
  );
}
