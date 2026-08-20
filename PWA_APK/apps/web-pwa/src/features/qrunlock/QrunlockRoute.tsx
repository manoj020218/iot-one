import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { QrunlockDevicePage } from "./QrunlockDevicePage";
import "./qrunlock.css";
import { listQrunlockDevices, type QrunlockDeviceSummary } from "./services/qrunlockApi";

/**
 * /qrunlock/* — a dedicated top-level route for QRunlock, same pattern as
 * /streamer/* (StreamerRoute.tsx), reached via a bottom-nav item gated by
 * useHasQrunlockDevice.ts. Unlike StreamerRoute this does NOT go through
 * RemoteProductMount / the dynamic UI-package loader — QRunlock's screens
 * are simple enough to ship as an ordinary bundled feature (the "lighter
 * option" described in PLATFORM_ARCHITECTURE_AND_ROLES.md §4), so this is
 * a plain nested React Router tree instead.
 *
 * - /qrunlock            -> device list (auto-forwards if there's exactly one)
 * - /qrunlock/:deviceId  -> the device control screen
 */
export function QrunlockRoute() {
  return (
    <Routes>
      <Route element={<QrunlockDeviceListRoute />} path="/" />
      <Route element={<QrunlockDeviceRoute />} path=":deviceId" />
    </Routes>
  );
}

function QrunlockDeviceListRoute() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<QrunlockDeviceSummary[] | null>(null);

  if (!session) {
    throw new Error("QrunlockRoute requires an authenticated session");
  }

  useEffect(() => {
    let active = true;
    listQrunlockDevices(session)
      .then((result) => {
        if (!active) return;
        setDevices(result);
        if (result.length === 1) {
          navigate(`/qrunlock/${encodeURIComponent(result[0]!.deviceId)}`, { replace: true });
        }
      })
      .catch(() => {
        if (active) setDevices([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (devices === null) {
    return (
      <div className="qr-page">
        <div className="qr-empty">Loading your QRunlock devices…</div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="qr-page">
        <div className="qr-empty">
          No QRunlock devices on this home yet. Add one from the &ldquo;+&rdquo; button on Home.
        </div>
      </div>
    );
  }

  return (
    <div className="qr-page">
      <div className="qr-head">
        <div className="titles">
          <div className="nm">QRunlock devices</div>
        </div>
      </div>
      <div className="qr-card">
        {devices.map((device) => (
          <button
            className="qr-row"
            key={device.deviceId}
            onClick={() => navigate(`/qrunlock/${encodeURIComponent(device.deviceId)}`)}
            type="button"
          >
            <span className="ic">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                <rect height="10" rx="2.4" width="15" x="4.5" y="10.5" />
                <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <span className="body">
              <span className="t">{device.friendlyName}</span>
              <span className="s">{device.onlineStatus === "online" ? "Online" : "Offline"}</span>
            </span>
            <svg className="chev" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeWidth="3" viewBox="0 0 24 24" width="15">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function QrunlockDeviceRoute() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { deviceId } = useParams<{ deviceId: string }>();

  if (!session) {
    throw new Error("QrunlockRoute requires an authenticated session");
  }

  if (!deviceId) {
    return <Navigate replace to="/qrunlock" />;
  }

  return (
    <QrunlockDevicePage
      deviceId={deviceId}
      onDeviceListRequested={() => navigate("/qrunlock")}
      session={session}
    />
  );
}
