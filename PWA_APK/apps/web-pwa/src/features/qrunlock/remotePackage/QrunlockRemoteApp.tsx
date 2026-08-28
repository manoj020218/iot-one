import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { AuthSession } from "@jenix/shared";

import type { RemoteProductPackageProps } from "../../devices/plugins/remoteProductPackage.types";
import { QrunlockDevicePage } from "../QrunlockDevicePage";
import "../qrunlock.css";
import { listQrunlockDevices, type QrunlockDeviceSummary } from "../services/qrunlockApi";

/**
 * The QRunlock remote package's entry component -- compiled to
 * remoteEntry.js by this folder's vite.config.ts and mounted via
 * RemoteProductMount (see features/qrunlock/QrunlockRoute.tsx, the
 * host-side wrapper that supplies session/homeId). Internal routing
 * (device list -> device detail) is unchanged from the original bundled
 * QrunlockRoute.tsx, just re-homed here so it can take session/homeId as
 * props instead of reading them off the host's AuthContext, which a
 * separately-bundled script can't see.
 *
 * QrunlockDevicePage and every component underneath it (LockHero,
 * ActivityFeed, QrunlockSettingsPanel, RfRemoteSetupScreen,
 * RenameDeviceSheet, QrunlockInchingPanel, services/qrunlockApi.ts) are
 * unchanged and reused verbatim -- they already took `session` as an
 * explicit prop, so nothing about the actual device UI/logic moved.
 */
export function QrunlockRemoteApp({ session }: RemoteProductPackageProps) {
  return (
    <Routes>
      <Route element={<QrunlockDeviceListScreen session={session} />} path="/" />
      <Route element={<QrunlockDeviceDetailScreen session={session} />} path=":deviceId" />
    </Routes>
  );
}

function QrunlockDeviceListScreen({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<QrunlockDeviceSummary[] | null>(null);

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

function QrunlockDeviceDetailScreen({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const { deviceId } = useParams<{ deviceId: string }>();

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
