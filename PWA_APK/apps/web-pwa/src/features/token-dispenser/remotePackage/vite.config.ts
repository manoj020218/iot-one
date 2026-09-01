import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRemotePackageConfig } from "../../../platform/remotePackageBuild/createRemotePackageConfig";

/**
 * Builds Token Dispenser's device UI into a standalone remoteEntry.js --
 * run via `pnpm --filter @jenix/web-pwa build:token-dispenser-package` (see
 * package.json). Not part of the main `vite build`, per
 * DEVICE_PACKAGE_RUNTIME.md's "every device UI is a dynamic remote package"
 * rule -- mirrors qrunlock's own remotePackage/vite.config.ts exactly.
 */
export default createRemotePackageConfig({
  configDir: path.dirname(fileURLToPath(import.meta.url)),
  entry: "register.ts",
  outDir: "../../../../public/ui-packages/token-dispenser-mobile/1.0.0"
});
