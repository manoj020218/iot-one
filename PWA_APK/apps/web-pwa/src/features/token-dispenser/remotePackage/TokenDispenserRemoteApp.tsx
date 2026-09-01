import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { AuthSession } from "@jenix/shared";

import type { RemoteProductPackageProps } from "../../devices/plugins/remoteProductPackage.types";
import { TokenDispenserPage } from "../TokenDispenserPage";
import "../token-dispenser.css";
import {
  listTokenDispenserDevices,
  type TokenDispenserDeviceSummary
} from "../services/tokenDispenserApi";

/**
 * Token Dispenser's remote package entry component -- compiled to
 * remoteEntry.js by this folder's vite.config.ts and mounted via
 * RemoteProductMount (see features/token-dispenser/TokenDispenserRoute.tsx).
 * Mirrors QrunlockRemoteApp.tsx exactly, per DEVICE_PACKAGE_RUNTIME.md's
 * "every device UI is a dynamic remote package" rule.
 */
export function TokenDispenserRemoteApp({ session }: RemoteProductPackageProps) {
  return (
    <Routes>
      <Route element={<TokenDispenserDeviceListScreen session={session} />} path="/" />
      <Route element={<TokenDispenserDeviceDetailScreen session={session} />} path=":deviceId" />
    </Routes>
  );
}

function TokenDispenserDeviceListScreen({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<TokenDispenserDeviceSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    listTokenDispenserDevices(session)
      .then((result) => {
        if (!active) return;
        setDevices(result);
        if (result.length === 1) {
          navigate(`/token-dispenser/${encodeURIComponent(result[0]!.deviceId)}`, { replace: true });
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
      <article className="scene-card" style={{ margin: 16 }}>
        <p className="hint-text">Loading your Token Dispenser devices…</p>
      </article>
    );
  }

  if (devices.length === 0) {
    return (
      <article className="scene-card" style={{ margin: 16 }}>
        <p className="hint-text">
          No Token Dispenser devices on this home yet. Add one from the &ldquo;+&rdquo; button
          on Home.
        </p>
      </article>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="content-grid">
        {devices.map((device) => (
          <button
            className="scene-card"
            key={device.deviceId}
            onClick={() => navigate(`/token-dispenser/${encodeURIComponent(device.deviceId)}`)}
            style={{ textAlign: "left", cursor: "pointer" }}
            type="button"
          >
            <p className="scene-card-kicker">Token Dispenser</p>
            <h3 style={{ margin: 0 }}>{device.displayName}</h3>
            <p className="hint-text" style={{ margin: 0 }}>
              {device.onlineStatus === "online" ? "Online" : "Offline"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function TokenDispenserDeviceDetailScreen({ session }: { session: AuthSession }) {
  const { deviceId } = useParams<{ deviceId: string }>();

  if (!deviceId) {
    return <Navigate replace to="/token-dispenser" />;
  }

  return <TokenDispenserPage deviceId={deviceId} session={session} />;
}
