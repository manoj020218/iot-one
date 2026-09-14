import { useEffect, useState } from "react";

import { getAnnouncementStatus } from "../schoolBellLocalApi";
import type { AudioStatus } from "../schoolBellAudioCloudTypes";

/** Light polling so the app can show "hardware PTT is live" and grey out the soft-talk button — the device enforces single-owner regardless. */
export function useAnnouncementStatus(baseUrl: string | null, activeIntervalMs = 2000): AudioStatus | null {
  const [status, setStatus] = useState<AudioStatus | null>(null);

  useEffect(() => {
    if (!baseUrl) {
      setStatus(null);
      return;
    }
    let active = true;
    const poll = () => {
      getAnnouncementStatus(baseUrl)
        .then((result) => {
          if (active) setStatus(result);
        })
        .catch(() => {
          // Transient poll failure — keep the last-known status rather than flashing an error state.
        });
    };
    poll();
    const interval = setInterval(poll, activeIntervalMs);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [baseUrl, activeIntervalMs]);

  return status;
}
