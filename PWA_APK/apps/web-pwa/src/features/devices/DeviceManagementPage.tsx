import { AppShell, StatusPill } from "@jenix/ui";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import {
  listManagedDevices,
  type ManagedDeviceSummary
} from "./services/deviceManagementApi";

export function DeviceManagementPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<ManagedDeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    throw new Error("DeviceManagementPage requires an authenticated session");
  }

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    void listManagedDevices(session)
      .then((records) => {
        if (active) {
          setDevices(records);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load devices."
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
  }, [session]);

  return (
    <AppShell
      eyebrow="Device Center"
      title="Device Management"
      description="Manage current-home devices, inspect operational state, and open PID-driven detail pages without hardcoded product dashboards."
      aside={<StatusPill label="Phase 9" tone="neutral" />}
    >
      <section className="tabs-strip">
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
          onClick={() => navigate("/provisioning")}
        >
          Provisioning
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/settings")}
        >
          Settings
        </button>
      </section>
      {loading ? <section className="panel">Loading managed devices...</section> : null}
      {error ? <section className="panel">{error}</section> : null}
      {!loading && !devices.length ? (
        <section className="empty-state">
          <h2>No devices in this HOME</h2>
          <p>Add a device through provisioning to populate the device center.</p>
          <button
            className="add-device-button"
            type="button"
            onClick={() => navigate("/provisioning")}
          >
            + Add Device
          </button>
        </section>
      ) : null}
      {!loading && devices.length ? (
        <section className="content-grid">
          {devices.map((device) => (
            <article key={device.deviceId} className="device-card">
              <div className="device-card-head">
                <div className="device-icon">{device.pidIconText}</div>
                <div>
                  <p className="device-pid-label">{device.pidLabel}</p>
                  <p className="device-pid-code">{device.pid}</p>
                </div>
              </div>
              <div>
                <h3>{device.displayName}</h3>
                <p>{device.telemetryPreview}</p>
              </div>
              <dl className="summary-grid">
                <div>
                  <dt>Firmware</dt>
                  <dd>{device.firmwareVersion ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Hardware</dt>
                  <dd>{device.hardwareRevision ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Cloud</dt>
                  <dd>{device.cloudStatus}</dd>
                </div>
                <div>
                  <dt>Matter</dt>
                  <dd>{device.matterEnabled ? "Enabled" : "Disabled"}</dd>
                </div>
              </dl>
              <div className="card-actions">
                <span>{device.online ? "Online" : "Offline"}</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => navigate(`/devices/${device.deviceId}`)}
                >
                  Open Details
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
