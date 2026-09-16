import { useEffect } from "react";

/**
 * Holds a Screen Wake Lock for as long as the calling screen is mounted --
 * provisioning (BLE especially) can take a couple of minutes, and if the
 * screen times out and locks mid-flow, Android treats the app as
 * backgrounded. That's fatal specifically when the user granted Bluetooth/
 * location as a one-time ("Only this time") permission: Android revokes it
 * and kills the whole app process the moment it leaves the foreground,
 * which is indistinguishable from provisioning just failing. Keeping the
 * screen on removes that trigger regardless of which permission option the
 * user picked -- it can't make Android grant "While using the app" for
 * them, but it stops the backgrounding that turns a one-time grant into a
 * killed app.
 *
 * Plain Screen Wake Lock API (Chromium via the WebView already supports it,
 * same as the desktop/web build) -- no native plugin needed. Silently a
 * no-op where unsupported (older WebView, desktop browsers without the
 * API): failing to acquire it just means the old screen-timeout behavior,
 * not a broken provisioning flow.
 */
export function useKeepScreenAwake(): void {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock?.request("screen");
        if (cancelled) {
          void lock?.release();
          return;
        }
        sentinel = lock ?? null;
      } catch {
        // Not supported, or the OS refused (e.g. low battery saver) --
        // nothing to do, the screen just times out normally.
      }
    }

    function handleVisibilityChange() {
      // The Wake Lock spec releases the lock automatically whenever the
      // document goes hidden, and never re-acquires it on its own -- so
      // returning to the app after a brief background dip (e.g. answering
      // a call) would otherwise leave the rest of the flow unprotected.
      if (document.visibilityState === "visible") {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void sentinel?.release();
    };
  }, []);
}
