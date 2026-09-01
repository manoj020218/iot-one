import tokenDispenserCss from "../token-dispenser.css?inline";
import { TokenDispenserRemoteApp } from "./TokenDispenserRemoteApp";

/**
 * The actual bundle entry point (see vite.config.ts). Mirrors QRunlock's
 * remotePackage/register.ts exactly -- see that file's own doc comment for
 * the full contract (devicePackageRegistry.ts injects <script
 * src=".../remoteEntry.js">, this registers the export on the shared host
 * object, and injects its own <style> tag since the loader never inserts a
 * stylesheet <link>).
 */
const host = typeof window !== "undefined" ? window.__JENIX_DEVICE_PACKAGE_HOST__ : undefined;

if (!host) {
  throw new Error(
    "token-dispenser-mobile: device package host runtime is not initialized. This script must be loaded via devicePackageRegistry.ts, not included directly."
  );
}

if (
  typeof document !== "undefined" &&
  !document.querySelector('style[data-jenix-package="token-dispenser-mobile"]')
) {
  const styleEl = document.createElement("style");
  styleEl.dataset.jenixPackage = "token-dispenser-mobile";
  styleEl.textContent = tokenDispenserCss;
  document.head.appendChild(styleEl);
}

host.registerPackage({
  packageId: "token-dispenser-mobile",
  version: "1.0.0",
  exports: {
    TokenDispenserApp: TokenDispenserRemoteApp
  }
});
