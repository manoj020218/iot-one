import { useEffect, useState } from "react";
import { getCurrentHome, type HomeUiBootstrapPackageRecord } from "@jenix/shared";

import { RemoteProductMount } from "../devices/plugins/RemoteProductMount";
import { getHomeUiBootstrap, findUiPackageForPid } from "../devices/services/uiBootstrapApi";
import { useAuth } from "../auth/hooks/useAuth";
import { SCHOOL_BELL_PID } from "./schoolBellPid";

/**
 * /school-bell/* -- same pattern as /qrunlock/* (QrunlockRoute.tsx). All
 * real screens live in remotePackage/SchoolBellRemoteApp.tsx and
 * features/school-bell/components/*, built into a standalone
 * remoteEntry.js instead of shipping inside the base app bundle. This is
 * the one route-registration line School Bell adds to AppRouter.tsx.
 */
export function SchoolBellRoute() {
  const { session } = useAuth();
  const [packageRecord, setPackageRecord] = useState<HomeUiBootstrapPackageRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  if (!session) {
    throw new Error("SchoolBellRoute requires an authenticated session");
  }

  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  useEffect(() => {
    let active = true;
    getHomeUiBootstrap(session)
      .then((bootstrap) => {
        if (!active) return;
        const found = findUiPackageForPid(bootstrap, SCHOOL_BELL_PID);
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
      <div className="sb-page sb-empty">
        Control screen unavailable — try refreshing, or check back after your next app update.
      </div>
    );
  }

  if (!packageRecord) {
    return <div className="sb-page sb-empty">Loading…</div>;
  }

  return <RemoteProductMount homeId={currentHome.homeId} packageRecord={packageRecord} session={session} />;
}
