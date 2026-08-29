import { useEffect, useState } from "react";
import { getCurrentHome, type HomeUiBootstrapPackageRecord } from "@jenix/shared";

import { RemoteProductMount } from "../devices/plugins/RemoteProductMount";
import { getHomeUiBootstrap, findUiPackageForPid } from "../devices/services/uiBootstrapApi";
import { useAuth } from "../auth/hooks/useAuth";
import { QRUNLOCK_PID } from "./qrunlockPid";

/**
 * /qrunlock/* -- same pattern as /streamer/* (StreamerRoute.tsx). QRunlock's
 * actual screens (device list, lock hero, RF remote setup, settings, ...)
 * live in remotePackage/QrunlockRemoteApp.tsx and every component under
 * features/qrunlock/ -- unchanged from the previous bundled version, just
 * built into a standalone remoteEntry.js (see remotePackage/vite.config.ts)
 * instead of shipping inside the base app bundle.
 *
 * Resolves the package's version/paths from the HOME's own UI-bootstrap
 * response (QRUNLOCK_PID is registered as uiMode "remote-package" — see
 * VPS/HANDOFF.md's Round 8) instead of a hardcoded constant. That constant
 * used to compile into the native app's own bundled assets, so bumping a
 * version to ship a fix required a full APK rebuild + reinstall for
 * anyone already running the app — publishing a new version server-side
 * now reaches every install on its next bootstrap fetch instead.
 */
export function QrunlockRoute() {
  const { session } = useAuth();
  const [packageRecord, setPackageRecord] = useState<HomeUiBootstrapPackageRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  if (!session) {
    throw new Error("QrunlockRoute requires an authenticated session");
  }

  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  useEffect(() => {
    let active = true;
    getHomeUiBootstrap(session)
      .then((bootstrap) => {
        if (!active) return;
        const found = findUiPackageForPid(bootstrap, QRUNLOCK_PID);
        if (found) {
          setPackageRecord(found);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentHome.homeId]);

  if (notFound) {
    return (
      <div className="qr-page">
        <div className="qr-empty">
          Control screen unavailable — try refreshing, or check back after your next app
          update.
        </div>
      </div>
    );
  }

  if (!packageRecord) {
    return (
      <div className="qr-page">
        <div className="qr-empty">Loading…</div>
      </div>
    );
  }

  return (
    <RemoteProductMount homeId={currentHome.homeId} packageRecord={packageRecord} session={session} />
  );
}
