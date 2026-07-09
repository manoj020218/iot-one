import React from "react";
import {
  createUiPackageKey,
  type HomeUiBootstrapPackageRecord
} from "@jenix/shared";

import type { DevicePackageComponent } from "./devicePackage.types";

interface DevicePackageRegistration {
  packageId: string;
  version: string;
  exports: Record<string, unknown>;
}

interface DevicePackageHost {
  React: typeof React;
  registerPackage: (registration: DevicePackageRegistration) => void;
  resolvePackage: (packageKey: string) => DevicePackageRegistration | undefined;
  reset: () => void;
}

declare global {
  interface Window {
    __JENIX_DEVICE_PACKAGE_HOST__?: DevicePackageHost;
  }
}

const registry = new Map<string, DevicePackageRegistration>();
const loadingScripts = new Map<string, Promise<void>>();

function getWindowHost(): DevicePackageHost {
  if (typeof window === "undefined") {
    throw new Error("Device package host is unavailable outside the browser");
  }

  if (!window.__JENIX_DEVICE_PACKAGE_HOST__) {
    window.__JENIX_DEVICE_PACKAGE_HOST__ = {
      React,
      registerPackage(registration) {
        registry.set(
          createUiPackageKey(registration.packageId, registration.version),
          registration
        );
      },
      resolvePackage(packageKey) {
        return registry.get(packageKey);
      },
      reset() {
        registry.clear();
        loadingScripts.clear();
      }
    };
  }

  return window.__JENIX_DEVICE_PACKAGE_HOST__;
}

function loadRemoteScript(packageKey: string, entryPath: string): Promise<void> {
  const existing = loadingScripts.get(packageKey);

  if (existing) {
    return existing;
  }

  const host = getWindowHost();
  if (host.resolvePackage(packageKey)) {
    return Promise.resolve();
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.packageKey = packageKey;
    script.src = entryPath;
    script.onload = () => {
      if (!host.resolvePackage(packageKey)) {
        reject(new Error(`Remote package did not register: ${packageKey}`));
        return;
      }

      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load remote package: ${entryPath}`));
    };
    document.head.appendChild(script);
  });

  loadingScripts.set(packageKey, promise);
  return promise;
}

export async function resolveDevicePackageComponent(
  record: HomeUiBootstrapPackageRecord
): Promise<DevicePackageComponent> {
  const packageKey = createUiPackageKey(record.packageId, record.version);
  const host = getWindowHost();

  if (!host.resolvePackage(packageKey)) {
    await loadRemoteScript(packageKey, record.entryPath);
  }

  const registered = host.resolvePackage(packageKey);
  const exported = registered?.exports[record.exportName];

  if (typeof exported !== "function") {
    throw new Error(`Device package export not found: ${record.exportName}`);
  }

  return exported as DevicePackageComponent;
}

export const devicePackageRegistryTesting = {
  reset() {
    if (typeof window !== "undefined" && window.__JENIX_DEVICE_PACKAGE_HOST__) {
      document
        .querySelectorAll("script[data-package-key]")
        .forEach((node) => node.parentElement?.removeChild(node));
      window.__JENIX_DEVICE_PACKAGE_HOST__.reset();
      delete window.__JENIX_DEVICE_PACKAGE_HOST__;
      return;
    }

    registry.clear();
    loadingScripts.clear();
  },
  seedPackage(
    packageId: string,
    version: string,
    exports: Record<string, unknown>
  ) {
    getWindowHost().registerPackage({
      packageId,
      version,
      exports
    });
  }
};
