/**
 * Build-time replacement for "react-router-dom" inside a remote package
 * bundle -- same rationale as reactHostShim.ts. Aliased in via each
 * package's vite.config.ts. A remote package's nested <Routes> only
 * resolves correctly against the host's single <BrowserRouter> (matching
 * relative paths, useNavigate, useParams, browser back button) if it's
 * using the exact react-router-dom module instance the host rendered
 * with, not a second bundled copy.
 */
const host = typeof window !== "undefined" ? window.__JENIX_DEVICE_PACKAGE_HOST__ : undefined;

if (!host) {
  throw new Error(
    "Device package host runtime is not initialized -- this bundle must be loaded as a remote package, not run standalone."
  );
}

const HostReactRouterDOM = host.ReactRouterDOM;

export const {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} = HostReactRouterDOM;
