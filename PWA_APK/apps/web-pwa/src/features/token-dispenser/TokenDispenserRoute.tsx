import { useEffect, useState } from "react";
import { getCurrentHome, type HomeUiBootstrapPackageRecord } from "@jenix/shared";

import { RemoteProductMount } from "../devices/plugins/RemoteProductMount";
import { getHomeUiBootstrap, findUiPackageForPid } from "../devices/services/uiBootstrapApi";
import { useAuth } from "../auth/hooks/useAuth";
import { TOKEN_DISPENSER_PID } from "./tokenDispenserPid";

/**
 * /token-dispenser/* -- same pattern as /qrunlock/* (QrunlockRoute.tsx), per
 * DEVICE_PACKAGE_RUNTIME.md's "every device UI is a dynamic remote package"
 * rule. Actual screens live in remotePackage/TokenDispenserRemoteApp.tsx and
 * every component under features/token-dispenser/ -- built to a standalone
 * remoteEntry.js (see remotePackage/vite.config.ts), never shipped inside
 * the base app bundle.
 *
 * Resolves the package's version/paths from the HOME's own UI-bootstrap
 * response (TOKEN_DISPENSER_PID is registered as uiMode "remote-package").
 */
export function TokenDispenserRoute() {
  const { session } = useAuth();
  const [packageRecord, setPackageRecord] = useState<HomeUiBootstrapPackageRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  if (!session) {
    throw new Error("TokenDispenserRoute requires an authenticated session");
  }

  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  useEffect(() => {
    let active = true;
    getHomeUiBootstrap(session)
      .then((bootstrap) => {
        if (!active) return;
        const found = findUiPackageForPid(bootstrap, TOKEN_DISPENSER_PID);
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
      <article className="scene-card" style={{ margin: 16 }}>
        <p className="hint-text">
          Control screen unavailable — try refreshing, or check back after your next app
          update.
        </p>
      </article>
    );
  }

  if (!packageRecord) {
    return (
      <article className="scene-card" style={{ margin: 16 }}>
        <p className="hint-text">Loading…</p>
      </article>
    );
  }

  return (
    <RemoteProductMount homeId={currentHome.homeId} packageRecord={packageRecord} session={session} />
  );
}
