import { AppShell, StatusPill } from "@jenix/ui";
import {
  type DeviceUiCommandRequest,
  type DeviceUiRuntimeState,
  type HomeUiBootstrapResponse,
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type DeviceRecord
} from "@jenix/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { DeviceFirmwarePanel } from "./components/DeviceFirmwarePanel";
import { DeviceMatterPanel } from "./components/DeviceMatterPanel";
import { DeviceRolloutHistoryPanel } from "./components/DeviceRolloutHistoryPanel";
import { PidDynamicPageRenderer } from "./components/PidDynamicPageRenderer";
import {
  dispatchDeviceUiCommand,
  getDeviceUiRuntime
} from "./services/devicePluginRuntimeApi";
import {
  getMatterStatus,
  getDevicePidProfile,
  getResolvedFirmwarePlan,
  getManagedDevice,
  listDeviceFirmwareRollouts,
  replayFirmwareRollout,
  requestMatterBridgeSync,
  requestMatterCommissioning,
  requestFirmwareUpdate,
  type DeviceFirmwarePlan,
  type DeviceFirmwareRollout,
  type DevicePidProfile
} from "./services/deviceManagementApi";
import {
  findUiBindingForDevice,
  findUiPackageForDevice,
  getHomeUiBootstrap
} from "./services/uiBootstrapApi";
import type { MatterDeviceStatus } from "@jenix/shared";

export function DeviceDetailPage() {
  const { session } = useAuth();
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [pidProfile, setPidProfile] = useState<DevicePidProfile | null>(null);
  const [firmwarePlan, setFirmwarePlan] = useState<DeviceFirmwarePlan | null>(null);
  const [rollouts, setRollouts] = useState<DeviceFirmwareRollout[]>([]);
  const [matterStatus, setMatterStatus] = useState<MatterDeviceStatus | null>(null);
  const [uiBootstrap, setUiBootstrap] = useState<HomeUiBootstrapResponse | null>(null);
  const [runtime, setRuntime] = useState<DeviceUiRuntimeState | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    throw new Error("DeviceDetailPage requires an authenticated session");
  }

  const activeSession = session;

  const currentHome = getSelectedHome(
    ensureDefaultHome(activeSession.homes, activeSession.user.userId),
    activeSession.user.userId,
    activeSession.activeHomeId
  );

  async function refreshFirmwareDeliveryState(
    record: DeviceRecord,
    profile: DevicePidProfile
  ) {
    const [plan, nextRollouts] = await Promise.all([
      getResolvedFirmwarePlan(activeSession, record, profile),
      listDeviceFirmwareRollouts(activeSession, record.deviceId)
    ]);

    setFirmwarePlan(plan);
    setRollouts(nextRollouts);
  }

  async function refreshDeviceRuntime(record: DeviceRecord) {
    setRuntime(await getDeviceUiRuntime(activeSession, record));
  }

  useEffect(() => {
    if (!deviceId) {
      setError("Device route is missing a device identifier.");
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);
    setError(null);
    setUiBootstrap(null);
    setRuntime(null);
    void getManagedDevice(activeSession, deviceId)
      .then(async (record) => {
        const profile = await getDevicePidProfile(record.pid);
        const [plan, matter, firmwareRollouts, nextBootstrap, nextRuntime] = await Promise.all([
          getResolvedFirmwarePlan(activeSession, record, profile),
          getMatterStatus(activeSession, record, profile),
          listDeviceFirmwareRollouts(activeSession, record.deviceId),
          getHomeUiBootstrap(activeSession),
          getDeviceUiRuntime(activeSession, record)
        ]);

        if (active) {
          setDevice(record);
          setPidProfile(profile);
          setFirmwarePlan(plan);
          setRollouts(firmwareRollouts);
          setMatterStatus(matter);
          setUiBootstrap(nextBootstrap);
          setRuntime(nextRuntime);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load device details."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeSession, deviceId]);

  const uiBinding =
    device && uiBootstrap ? findUiBindingForDevice(uiBootstrap, device.deviceId) : undefined;
  const uiPackage =
    device && uiBootstrap ? findUiPackageForDevice(uiBootstrap, device.deviceId) : undefined;

  return (
    <AppShell
      eyebrow="Device Detail"
      title={device?.displayName ?? deviceId ?? "Device"}
      description="Phase 11 extends device detail pages with Matter readiness, bridge placeholders, OTA resolution, and PID-driven rendering on a shared device contract."
      aside={<StatusPill label={currentHome.role.toUpperCase()} tone="neutral" />}
    >
      <section className="tabs-strip">
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/devices")}
        >
          Device Center
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/home")}
        >
          Dashboard
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/scenes")}
        >
          Scenes
        </button>
      </section>
      {loading ? <section className="panel">Loading device detail...</section> : null}
      {error ? <section className="panel">{error}</section> : null}
      {!loading && device && pidProfile && firmwarePlan && matterStatus ? (
        <>
          <section className="panel device-detail-hero">
            <div className="device-card-head">
              <div className="device-icon">
                {pidProfile.pid
                  .split("-")
                  .slice(1, 3)
                  .map((part) => part[0] ?? "")
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <p className="device-pid-label">{pidProfile.productName}</p>
                <p className="device-pid-code">{pidProfile.pid}</p>
              </div>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>Device ID</dt>
                <dd>{device.deviceId}</dd>
              </div>
              <div>
                <dt>Firmware</dt>
                <dd>{device.firmwareVersion ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Hardware</dt>
                <dd>{device.hardwareRevision ?? pidProfile.hardware.hardwareRevision}</dd>
              </div>
              <div>
                <dt>Matter</dt>
                <dd>{matterStatus.enabled ? matterStatus.mode : "Disabled"}</dd>
              </div>
              <div>
                <dt>Cloud</dt>
                <dd>{device.cloudStatus}</dd>
              </div>
              <div>
                <dt>MQTT</dt>
                <dd>{device.mqttStatus}</dd>
              </div>
              <div>
                <dt>Last Seen</dt>
                <dd>{device.lastSeenAt ?? "Waiting for telemetry"}</dd>
              </div>
              <div>
                <dt>Template</dt>
                <dd>{pidProfile.dashboard.templateId}</dd>
              </div>
            </dl>
          </section>
          <DeviceFirmwarePanel
            plan={firmwarePlan}
            onRequest={async (input) => {
              const result = await requestFirmwareUpdate(
                activeSession,
                device.deviceId,
                input
              );
              await refreshFirmwareDeliveryState(device, pidProfile);
              return result;
            }}
          />
          <DeviceRolloutHistoryPanel
            rollouts={rollouts}
            canReplay={currentHome.role !== "viewer"}
            onReplay={async (requestId) => {
              const replayed = await replayFirmwareRollout(
                activeSession,
                device.deviceId,
                requestId
              );
              await refreshFirmwareDeliveryState(device, pidProfile);
              return replayed;
            }}
            onRefresh={() => refreshFirmwareDeliveryState(device, pidProfile)}
          />
          <DeviceMatterPanel
            status={matterStatus}
            homeRole={currentHome.role}
            onCommission={async () => {
              const result = await requestMatterCommissioning(
                activeSession,
                device,
                pidProfile
              );
              setMatterStatus(
                await getMatterStatus(activeSession, device, pidProfile)
              );
              return result;
            }}
            onBridgeSync={async () => {
              const result = await requestMatterBridgeSync(
                activeSession,
                device,
                pidProfile
              );
              setMatterStatus(
                await getMatterStatus(activeSession, device, pidProfile)
              );
              return result;
            }}
          />
          <section className="device-dynamic-section">
            <div className="scene-section-head">
              <div>
                <span className="eyebrow">Dynamic Pages</span>
                <h2>PID-driven Device Pages</h2>
                <p className="hint-text">
                  These panels are selected from the PID dashboard definition instead of
                  being hardcoded per product.
                </p>
              </div>
            </div>
            <PidDynamicPageRenderer
              busy={runtimeBusy}
              device={device}
              pidProfile={pidProfile}
              runtime={runtime}
              uiBinding={uiBinding}
              uiPackage={uiPackage}
              onRefresh={async () => {
                setRuntimeBusy(true);
                try {
                  await refreshDeviceRuntime(device);
                } finally {
                  setRuntimeBusy(false);
                }
              }}
              onCommand={async (input: DeviceUiCommandRequest) => {
                setRuntimeBusy(true);
                try {
                  await dispatchDeviceUiCommand(activeSession, device, input);
                  await refreshDeviceRuntime(device);
                } finally {
                  setRuntimeBusy(false);
                }
              }}
            />
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
