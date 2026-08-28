/**
 * Build-time replacement for the real "react" package inside a remote
 * package bundle. Aliased in via each package's vite.config.ts
 * (resolve.alias: { react: .../reactHostShim.ts }), so every source file
 * keeps writing a completely normal `import React from "react"` --
 * TypeScript still type-checks against the real @types/react, only the
 * bundled runtime value changes.
 *
 * Reads React off window.__JENIX_DEVICE_PACKAGE_HOST__ instead of bundling
 * its own copy, so hooks and context created by the host app (or by other
 * already-loaded remote packages) resolve correctly -- two different
 * React module instances would each have their own Context identities, and
 * useContext only matches a Provider created by the *same* instance.
 * devicePackageRegistry.ts guarantees the host object exists before any
 * remote package's <script> tag is even inserted, so this is safe to read
 * at module-evaluation time.
 */
const host = typeof window !== "undefined" ? window.__JENIX_DEVICE_PACKAGE_HOST__ : undefined;

if (!host) {
  throw new Error(
    "Device package host runtime is not initialized -- this bundle must be loaded as a remote package, not run standalone."
  );
}

const HostReact = host.React;

export default HostReact;
export const {
  Children,
  Component,
  Fragment,
  PureComponent,
  StrictMode,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version
} = HostReact;
