/**
 * Prefix for every "/api/v1/..." endpoint constant across the app's *Api.ts
 * modules. Empty for the hosted PWA (relative paths resolve against its own
 * origin, one.jenix.in, via nginx's /api/ proxy) -- but the Capacitor app is
 * served from https://localhost/, which has no backend of its own, so a bare
 * relative path silently targets the wrong host.
 *
 * Resolved at RUNTIME (via window.Capacitor's presence), not from
 * VITE_API_ORIGIN alone -- that build-time env var is only ever defined by
 * PWA_APK/apps/web-pwa's own build:capacitor script (.env.capacitor). Code
 * bundled into a remote package (platform/remotePackageBuild/) is built by
 * its own separate, mode-less Vite config and shipped as ONE artifact
 * fetched by both the hosted PWA and the native app -- it never sees that
 * env var, so relying on it alone silently produced relative, wrong-origin
 * requests inside every remote package. window.Capacitor's presence is a
 * runtime fact, true regardless of which build produced the current code.
 *
 * Deliberately its own leaf module (no imports of app modules) --
 * authenticatedRequest.ts has a circular import with authApi.ts (it imports
 * refreshAuthSession from there), and defining apiOrigin inside that cycle
 * left it `undefined` at authApi.ts's module-init time in some import
 * orders.
 */
const PRODUCTION_API_ORIGIN = "https://one.jenix.in";

function isRunningInNativeShell(): boolean {
  return typeof window !== "undefined" && Boolean((window as Window & { Capacitor?: unknown }).Capacitor);
}

export const apiOrigin =
  (import.meta.env.VITE_API_ORIGIN as string | undefined) ??
  (isRunningInNativeShell() ? PRODUCTION_API_ORIGIN : "");
