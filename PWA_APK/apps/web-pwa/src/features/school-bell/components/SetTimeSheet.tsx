import { useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import { setDeviceTime } from "../services/schoolBellLocalApi";

export interface SetTimeSheetProps {
  open: boolean;
  onClose: () => void;
  baseUrl: string | null;
  onSynced: () => void;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:MM:SS" as required by POST /api/v1/time (clock.set). */
function phoneLocalTimeString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Every schedule on the device runs against its own DS3231 RTC, not the
 * phone's clock (see useDeviceClock.ts) — this is the one place that's
 * allowed to push a new time onto the device, and it does so explicitly,
 * never automatically, so a wrong phone clock can't silently corrupt a
 * correctly-set bell schedule.
 */
export function SetTimeSheet({ open, onClose, baseUrl, onSynced }: SetTimeSheetProps) {
  const [manualTime, setManualTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(localTime: string) {
    if (!baseUrl) return;
    setBusy(true);
    setError(null);
    try {
      await setDeviceTime(baseUrl, localTime);
      onSynced();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the device's time");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} open={open} subtitle="Every schedule runs on this clock, not your phone's" title="Set device time">
      <button className="sb-btn primary" disabled={busy} onClick={() => apply(phoneLocalTimeString())} type="button">
        {busy ? "Syncing…" : "Sync to this phone's time"}
      </button>
      <div className="sb-field" style={{ marginTop: 16 }}>
        <label>Or set manually — YYYY-MM-DDTHH:MM:SS</label>
        <input onChange={(event) => setManualTime(event.target.value)} placeholder="2026-09-09T11:42:00" type="text" value={manualTime} />
      </div>
      {error ? <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p> : null}
      <button className="sb-btn ghost" disabled={busy || !manualTime.trim()} onClick={() => apply(manualTime.trim())} type="button">
        Set manually
      </button>
    </Sheet>
  );
}
