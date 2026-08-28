import qrunlockCss from "../qrunlock.css?inline";
import { QrunlockRemoteApp } from "./QrunlockRemoteApp";

/**
 * The actual bundle entry point (see vite.config.ts). Runs once when
 * devicePackageRegistry.ts injects <script src=".../remoteEntry.js">,
 * and registers this package's export on the shared host object -- the
 * same contract Tank Guard's hand-written remoteEntry.js used, just
 * produced by a real TSX + Vite build instead of hand-authored
 * React.createElement calls.
 *
 * devicePackageRegistry.ts only ever injects a <script> tag, never a
 * stylesheet <link>, so qrunlock.css (pulled in as a plain side-effect
 * import by QrunlockDevicePage.tsx and friends -- unchanged, still needed
 * for the bundled build) wouldn't otherwise reach the page. Pulling it in
 * here too via Vite's `?inline` query gets it as a plain string instead of
 * a separately-extracted asset, so this script can inject it itself and
 * stay a true single-file package.
 */
const host = typeof window !== "undefined" ? window.__JENIX_DEVICE_PACKAGE_HOST__ : undefined;

if (!host) {
  throw new Error(
    "qrunlock-mobile: device package host runtime is not initialized. This script must be loaded via devicePackageRegistry.ts, not included directly."
  );
}

if (typeof document !== "undefined" && !document.querySelector('style[data-jenix-package="qrunlock-mobile"]')) {
  const styleEl = document.createElement("style");
  styleEl.dataset.jenixPackage = "qrunlock-mobile";
  styleEl.textContent = qrunlockCss;
  document.head.appendChild(styleEl);
}

host.registerPackage({
  packageId: "qrunlock-mobile",
  version: "1.0.0",
  exports: {
    QrunlockApp: QrunlockRemoteApp
  }
});
