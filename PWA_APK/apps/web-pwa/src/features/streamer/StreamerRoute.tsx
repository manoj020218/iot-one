import { getCurrentHome, type HomeUiBootstrapPackageRecord } from "@jenix/shared";

import { RemoteProductMount } from "../devices/plugins/RemoteProductMount";
import { useAuth } from "../auth/hooks/useAuth";

/**
 * TEMPORARY: hardcoded package coordinates until the VPS registers
 * "smart-streamer-plugin" through /api/v1/admin/ui-packages and binds it
 * to the STREAMER PID family (see VPS/API_CONTRACT.md and
 * SMART_STREAMER_PLATFORM_ADDITIONS.md). Once that lands, replace this
 * with the matching entry from the home-bootstrap response's
 * `packages`/`pidBindings`, the same way PidDynamicPageRenderer already
 * consumes it for per-device packages.
 */
const SMART_STREAMER_PACKAGE: HomeUiBootstrapPackageRecord = {
  packageId: "smart-streamer-plugin",
  version: "1.0.0",
  manifestPath: "/ui-packages/smart-streamer-plugin/1.0.0/manifest.json",
  entryPath: "/ui-packages/smart-streamer-plugin/1.0.0/remoteEntry.js",
  exportName: "SmartStreamerApp"
};

export function StreamerRoute() {
  const { session } = useAuth();

  if (!session) {
    throw new Error("StreamerRoute requires an authenticated session");
  }

  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  return (
    <RemoteProductMount homeId={currentHome.homeId} packageRecord={SMART_STREAMER_PACKAGE} session={session} />
  );
}
