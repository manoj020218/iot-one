import React from "react";
import * as ReactRouterDOM from "react-router-dom";
import {
  createUiPackageKey,
  type HomeUiBootstrapPackageRecord
} from "@jenix/shared";

import { apiOrigin } from "../../../app/apiOrigin";
import type { DevicePackageComponent } from "./devicePackage.types";

interface DevicePackageRegistration {
  packageId: string;
  version: string;
  exports: Record<string, unknown>;
}

/**
 * React and react-router-dom are exposed as host singletons so a remote
 * package can use real hooks (useState, useNavigate, nested <Routes>, ...)
 * against the SAME module instance the host app rendered with. Context
 * objects (React's and react-router's alike) are matched by reference, not
 * shape, so a remote bundle that carried its own copy of either package
 * would silently fail to see the host's providers -- see
 * qrunlock/remotePackage/build's react/react-router-dom aliases for the
 * build-time half of this contract.
 */
interface DevicePackageHost {
  React: typeof React;
  ReactRouterDOM: typeof ReactRouterDOM;
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
      ReactRouterDOM,
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
    // entryPath is root-relative ("/ui-packages/..."), which only resolves
    // correctly when the current page's own origin serves it -- true for
    // the hosted PWA (one.jenix.in), but the native app's WebView origin
    // (https://localhost) has nothing at that path. Same fix as every
    // *Api.ts endpoint this session: prefix with apiOrigin, which is ""
    // on the web (no change) and the real API host inside Capacitor.
    script.src = `${apiOrigin}${entryPath}`;
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

/**
 * Generic over the resolved component's prop shape: per-device packages
 * (Tank Guard etc.) export a DevicePackageComponent, while product-level
 * packages (full routed plugins, see RemoteProductMount) export a
 * RemoteProductPackageComponent. The resolution mechanism — script-load,
 * host registration, named export lookup — is identical either way.
 */
export async function resolveDevicePackageComponent<
  T = DevicePackageComponent
>(record: HomeUiBootstrapPackageRecord): Promise<T> {
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

  return exported as T;
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
