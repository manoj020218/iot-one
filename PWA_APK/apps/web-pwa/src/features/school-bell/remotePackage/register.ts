import schoolBellCss from "../schoolBell.css?inline";
import { SchoolBellRemoteApp } from "./SchoolBellRemoteApp";

/**
 * Bundle entry point (see vite.config.ts) — same contract as
 * qrunlock-mobile/register.ts. Runs once when devicePackageRegistry.ts
 * injects <script src=".../remoteEntry.js">.
 */
const host = typeof window !== "undefined" ? window.__JENIX_DEVICE_PACKAGE_HOST__ : undefined;

if (!host) {
  throw new Error(
    "school-bell-mobile: device package host runtime is not initialized. This script must be loaded via devicePackageRegistry.ts, not included directly."
  );
}

if (typeof document !== "undefined" && !document.querySelector('style[data-jenix-package="school-bell-mobile"]')) {
  const styleEl = document.createElement("style");
  styleEl.dataset.jenixPackage = "school-bell-mobile";
  styleEl.textContent = schoolBellCss;
  document.head.appendChild(styleEl);
}

host.registerPackage({
  packageId: "school-bell-mobile",
  version: "1.0.0",
  exports: {
    SchoolBellApp: SchoolBellRemoteApp
  }
});
