/**
 * TypeScript-facing wrapper for WifiInfoPlugin.java (native Android) --
 * reads the phone's currently-connected Wi-Fi SSID to prefill the
 * provisioning form. Same window.Capacitor.Plugins access pattern as
 * nativeGoogleSignIn.ts. Unavailable on the hosted web PWA (no native
 * plugin there) -- callers should treat a null return as "fall back to
 * manual entry", not an error.
 */

export interface NativeWifiInfoPlugin {
  getCurrentSsid: () => Promise<{ ssid: string | null }>;
}

export function getNativeWifiInfoPlugin(): NativeWifiInfoPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (
    window as Window & {
      Capacitor?: {
        Plugins?: {
          WifiInfo?: NativeWifiInfoPlugin;
        };
      };
    }
  ).Capacitor?.Plugins?.WifiInfo;

  return candidate ?? null;
}

export async function requestCurrentWifiSsid(): Promise<string | null> {
  const plugin = getNativeWifiInfoPlugin();

  if (!plugin) {
    return null;
  }

  try {
    const result = await plugin.getCurrentSsid();
    return result.ssid ?? null;
  } catch {
    return null;
  }
}
