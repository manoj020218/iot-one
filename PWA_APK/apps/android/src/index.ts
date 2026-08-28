import { platformIdentity } from "@jenix/shared";

export interface CapacitorShellConfig {
  appId: string;
  appName: string;
  webDir: string;
}

export const androidShellConfig: CapacitorShellConfig = {
  appId: "in.jenix.one",
  appName: platformIdentity.appName,
  // Not ../web-pwa/dist -- that build uses base:"/app/" for the hosted PWA
  // (served at a subpath), which breaks asset loading in the WebView (it
  // requests https://localhost/app/assets/... but Capacitor serves from
  // https://localhost/). dist-capacitor is built with base:"/" via
  // `pnpm --filter @jenix/web-pwa build:capacitor` for exactly this reason.
  webDir: "../web-pwa/dist-capacitor"
};
