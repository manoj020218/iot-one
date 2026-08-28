/**
 * Prefix for every "/api/v1/..." endpoint constant across the app's *Api.ts
 * modules. Empty for the hosted PWA (relative paths resolve against its own
 * origin, one.jenix.in, via nginx's /api/ proxy) -- but the Capacitor app is
 * served from https://localhost/, which has no backend of its own, so a bare
 * relative path silently targets the wrong host. Set via VITE_API_ORIGIN,
 * which only PWA_APK/apps/web-pwa's build:capacitor script defines
 * (.env.capacitor) -- the regular `build` script leaves it unset.
 *
 * Deliberately its own leaf module (no imports) -- authenticatedRequest.ts
 * has a circular import with authApi.ts (it imports refreshAuthSession from
 * there), and defining apiOrigin inside that cycle left it `undefined` at
 * authApi.ts's module-init time in some import orders.
 */
export const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined) ?? "";
