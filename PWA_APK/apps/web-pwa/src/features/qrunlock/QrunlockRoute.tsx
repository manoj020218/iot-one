import { getCurrentHome, type HomeUiBootstrapPackageRecord } from "@jenix/shared";

import { RemoteProductMount } from "../devices/plugins/RemoteProductMount";
import { useAuth } from "../auth/hooks/useAuth";

/**
 * TEMPORARY: hardcoded package coordinates until the VPS registers
 * "qrunlock-mobile" through /api/v1/admin/ui-packages and binds it to the
 * QRunlock PID family, same interim state StreamerRoute.tsx documents for
 * Smart Streamer. Once that lands, replace this with the matching entry
 * from the home-bootstrap response's `packages`/`pidBindings`.
 */
const QRUNLOCK_PACKAGE: HomeUiBootstrapPackageRecord = {
  packageId: "qrunlock-mobile",
  version: "1.0.0",
  manifestPath: "/ui-packages/qrunlock-mobile/1.0.0/manifest.json",
  entryPath: "/ui-packages/qrunlock-mobile/1.0.0/remoteEntry.js",
  exportName: "QrunlockApp"
};

/**
 * /qrunlock/* -- same pattern as /streamer/* (StreamerRoute.tsx). QRunlock's
 * actual screens (device list, lock hero, RF remote setup, settings, ...)
 * live in remotePackage/QrunlockRemoteApp.tsx and every component under
 * features/qrunlock/ -- unchanged from the previous bundled version, just
 * built into a standalone remoteEntry.js (see remotePackage/vite.config.ts)
 * instead of shipping inside the base app bundle.
 */
export function QrunlockRoute() {
  const { session } = useAuth();

  if (!session) {
    throw new Error("QrunlockRoute requires an authenticated session");
  }

  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  return (
    <RemoteProductMount homeId={currentHome.homeId} packageRecord={QRUNLOCK_PACKAGE} session={session} />
  );
}
