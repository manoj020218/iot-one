import { AppShell, StatusPill } from "@jenix/ui";
import {
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type DeviceRecord
} from "@jenix/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { DeviceFirmwarePanel } from "./components/DeviceFirmwarePanel";
import { PidDynamicPageRenderer } from "./components/PidDynamicPageRenderer";
import {
  getDevicePidProfile,
  getResolvedFirmwarePlan,
  getManagedDevice,
  requestFirmwareUpdate,
  type DeviceFirmwarePlan,
  type DevicePidProfile
} from "./services/deviceManagementApi";

export function DeviceDetailPage() {
  const { session } = useAuth();
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [pidProfile, setPidProfile] = useState<DevicePidProfile | null>(null);
  const [firmwarePlan, setFirmwarePlan] = useState<DeviceFirmwarePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    throw new Error("DeviceDetailPage requires an authenticated session");
  }

  const currentHome = getSelectedHome(
    ensureDefaultHome(session.homes, session.user.userId),
    session.user.userId,
    session.activeHomeId
  );

  useEffect(() => {
    if (!deviceId) {
      setError("Device route is missing a device identifier.");
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);
    setError(null);
    void getManagedDevice(session, deviceId)
      .then(async (record) => {
        const profile = await getDevicePidProfile(record.pid);
        const plan = await getResolvedFirmwarePlan(session, record, profile);

        if (active) {
          setDevice(record);
          setPidProfile(profile);
          setFirmwarePlan(plan);
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
  }, [deviceId, session]);

  return (
    <AppShell
      eyebrow="Device Detail"
      title={device?.displayName ?? deviceId ?? "Device"}
      description="Phase 10 extends device detail pages with OTA resolution on top of PID metadata, while preserving safe fallback rendering for unsupported dynamic pages."
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
          onClick={() => navigate("/dashboard")}
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
      {!loading && device && pidProfile && firmwarePlan ? (
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
                <dd>{device.matterEnabled ? "Enabled" : "Disabled"}</dd>
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
            onRequest={(input) =>
              requestFirmwareUpdate(session, device.deviceId, input)
            }
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
            <PidDynamicPageRenderer device={device} pidProfile={pidProfile} />
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
