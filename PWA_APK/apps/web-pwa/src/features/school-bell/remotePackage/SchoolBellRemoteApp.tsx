import type { AuthSession } from "@jenix/shared";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";

import type { RemoteProductPackageProps } from "../../devices/plugins/remoteProductPackage.types";
import type { ManagedDeviceSummary } from "../../devices/services/deviceManagementApi";
import { listSchoolBellDevices } from "../services/schoolBellDevices";
import { SchoolBellDeviceListScreen } from "../components/SchoolBellDeviceListScreen";
import { SchoolBellShell } from "../components/SchoolBellShell";
import "../schoolBell.css";

/**
 * Entry component compiled to remoteEntry.js by this folder's
 * vite.config.ts — same shape as QrunlockRemoteApp.tsx (see
 * SchoolBellRoute.tsx for the host-side mount). Device list -> device
 * shell, exactly the QRunlock pattern.
 */
export function SchoolBellRemoteApp({ session }: RemoteProductPackageProps) {
  return (
    <Routes>
      <Route element={<DeviceListScreen session={session} />} path="/" />
      <Route element={<DeviceDetailScreen session={session} />} path=":deviceId" />
    </Routes>
  );
}

function DeviceListScreen({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  return (
    <SchoolBellDeviceListScreen
      onSelect={(deviceId) => navigate(`/school-bell/${encodeURIComponent(deviceId)}`)}
      session={session}
    />
  );
}

function DeviceDetailScreen({ session }: { session: AuthSession }) {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<ManagedDeviceSummary | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    let active = true;
    listSchoolBellDevices(session)
      .then((devices) => {
        if (!active) return;
        const found = devices.find((entry) => entry.deviceId === deviceId);
        if (found) {
          setDevice(found);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      });
    return () => {
      active = false;
    };
  }, [session, deviceId]);

  if (!deviceId) return <Navigate replace to="/school-bell" />;
  if (notFound) return <div className="sb-page sb-empty">This bell couldn&apos;t be loaded.</div>;
  if (!device) return <div className="sb-page sb-empty">Loading…</div>;

  return <SchoolBellShell device={device} session={session} />;
}
