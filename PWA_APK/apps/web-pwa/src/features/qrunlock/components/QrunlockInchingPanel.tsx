import { useEffect, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import { getSettings } from "../services/qrunlockApi";

/**
 * "Inching" is the duration of the unlock relay pulse itself. On
 * QRunlock this is currently fixed by firmware (config::kMinRelayPulseMs
 * === kMaxRelayPulseMs === 300 in IOT_Device/QRunlock/src/config/
 * Defaults.h), so this panel is read-only — it shows the real value from
 * the backend rather than a fake editable stepper, matching
 * IOT_Device/QRunlock/VPS/API_CONTRACT.md §4's own honesty about the
 * field. If firmware ever widens the range, settings.validation.ts on the
 * backend gains a real relayPulseMs field first, and only then does this
 * become editable.
 */
export function QrunlockInchingPanel({ session, deviceId }: { session: AuthSession; deviceId: string }) {
  const [pulseMs, setPulseMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getSettings(session, deviceId)
      .then((settings) => {
        if (active) setPulseMs(settings.relayPulseMs);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session, deviceId]);

  const seconds = pulseMs === null ? "0.3" : (pulseMs / 1000).toFixed(1);

  return (
    <div className="dev-timer-card">
      <div className="ft">Pulse duration</div>
      <div className="dev-timer-duration">
        <span className="n">{seconds}</span>
        <span className="u">sec</span>
      </div>
      <p className="hint">
        Every unlock is a single relay pulse of this length — matches QRunlock&apos;s fixed relay pulse
        width. It isn&apos;t adjustable yet: firmware doesn&apos;t support a variable pulse duration on
        this hardware revision.
      </p>
    </div>
  );
}
