/**
 * This plugin never bundles its own copy of React — it borrows the host
 * platform's instance at runtime so hooks share the same module (two
 * React copies in one page breaks hooks). Same mechanism the Tank Guard
 * remote package already uses in production
 * (PWA_APK/apps/web-pwa/public/ui-packages/tank-guard-mobile/1.0.0/remoteEntry.js).
 */
interface DevicePackageHost {
  React: typeof import("react");
  registerPackage: (registration: {
    packageId: string;
    version: string;
    exports: Record<string, unknown>;
  }) => void;
}

declare global {
  interface Window {
    __JENIX_DEVICE_PACKAGE_HOST__?: DevicePackageHost;
  }
}

function requireHost(): DevicePackageHost {
  const found = window.__JENIX_DEVICE_PACKAGE_HOST__;

  if (!found || !found.React || typeof found.registerPackage !== "function") {
    throw new Error("Jenix device package host is not available");
  }

  return found;
}

export const host = requireHost();
export const React = host.React;
