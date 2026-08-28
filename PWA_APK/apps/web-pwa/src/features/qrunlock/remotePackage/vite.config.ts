import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRemotePackageConfig } from "../../../platform/remotePackageBuild/createRemotePackageConfig";

/**
 * Builds QRunlock's device UI into a standalone remoteEntry.js -- run via
 * `pnpm --filter @jenix/web-pwa build:qrunlock-package` (see package.json).
 * Not part of the main `vite build`, so QRunlock's screens/CSS never ship
 * inside the base app bundle; they're fetched on demand only for a home
 * that actually has a QRunlock device (see QrunlockRoute.tsx).
 */
export default createRemotePackageConfig({
  configDir: path.dirname(fileURLToPath(import.meta.url)),
  entry: "register.ts",
  outDir: "../../../../public/ui-packages/qrunlock-mobile/1.0.0"
});
