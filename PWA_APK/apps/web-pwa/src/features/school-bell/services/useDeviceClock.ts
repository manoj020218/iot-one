import { useCallback, useEffect, useRef, useState } from "react";

import { getStatus } from "./schoolBellLocalApi";
import type { SchoolBellStatus } from "./schoolBellTypes";

const RESYNC_INTERVAL_MS = 30_000;

export interface DeviceClock {
  /** The bell's own current time, derived from its DS3231 RTC — never the phone's clock. Null until the first sync. */
  now: Date | null;
  timeValid: boolean;
  timezone: string | null;
  weekday: string | null;
  lastSyncedAt: Date | null;
  status: SchoolBellStatus | null;
  syncNow: () => void;
}

/**
 * All schedules run on the S3's own RTC, not the phone's clock — showing
 * `new Date()` anywhere in this plugin would be actively misleading if
 * the two drift apart. This hook fetches /status (same 30s cadence the
 * firmware's own embedded WebUI uses per API_V1.md) to get the device's
 * `local_time`, then ticks a local Date forward every second from that
 * anchor between syncs, so the displayed clock is always anchored to the
 * device's RTC and just interpolated for a smooth per-second display.
 */
export function useDeviceClock(baseUrl: string | null): DeviceClock {
  const [status, setStatus] = useState<SchoolBellStatus | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const anchorRef = useRef<{ deviceMs: number; capturedAtPerfMs: number } | null>(null);

  const syncNow = useCallback(() => {
    if (!baseUrl) return;
    void getStatus(baseUrl)
      .then((result) => {
        setStatus(result);
        setLastSyncedAt(new Date());
        if (result.time_valid && result.unix_time != null) {
          anchorRef.current = { deviceMs: result.unix_time * 1000, capturedAtPerfMs: performance.now() };
          setNow(new Date(anchorRef.current.deviceMs));
        } else {
          anchorRef.current = null;
          setNow(null);
        }
      })
      .catch(() => {
        // Leave the last-known anchor in place — a transient poll failure
        // shouldn't blank out a clock that was correct a second ago.
      });
  }, [baseUrl]);

  useEffect(() => {
    if (!baseUrl) {
      setStatus(null);
      setNow(null);
      anchorRef.current = null;
      return;
    }
    syncNow();
    const resync = setInterval(syncNow, RESYNC_INTERVAL_MS);
    return () => clearInterval(resync);
  }, [baseUrl, syncNow]);

  useEffect(() => {
    const tick = setInterval(() => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const elapsed = performance.now() - anchor.capturedAtPerfMs;
      setNow(new Date(anchor.deviceMs + elapsed));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  return {
    now,
    timeValid: status?.time_valid ?? false,
    timezone: status?.timezone ?? null,
    weekday: status?.weekday ?? null,
    lastSyncedAt,
    status,
    syncNow
  };
}
