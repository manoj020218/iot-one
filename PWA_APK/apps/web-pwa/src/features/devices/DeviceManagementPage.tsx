import { AppShell } from "@jenix/ui";
import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { DeviceCatalogGrid } from "./components/DeviceCatalogGrid";
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
      description="See every device in this home and open one for live status and controls."
      aside={
        <button
          aria-label="Add device"
          className="devices-add-button"
          onClick={() => navigate("/provisioning/ble")}
          type="button"
        >
          <FiPlus size={20} />
        </button>
      }
    >
      {loading ? <section className="panel">Loading managed devices...</section> : null}
      {error ? <section className="panel">{error}</section> : null}
      {!loading && !devices.length ? (
        <DeviceCatalogGrid onSelect={() => navigate("/provisioning/ble")} />
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
