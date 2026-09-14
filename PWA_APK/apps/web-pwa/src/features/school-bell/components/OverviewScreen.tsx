import type { HomeAccessRole } from "@jenix/shared";
import { useState } from "react";
import { FiBell, FiChevronRight, FiMic } from "react-icons/fi";

import { setAutomationEnabled } from "../services/schoolBellLocalApi";
import { canRingBell } from "../services/schoolBellRoles";
import { findNextBell, getActiveProfile, getTodaysSchedules } from "../services/scheduleSelectors";
import type { SchedulePackState } from "../services/useSchedulePack";
import type { DeviceClock } from "../services/useDeviceClock";
import type { SchoolBellConnection } from "../services/useSchoolBellConnection";
import { ConnectionStatusIcon } from "./ConnectionStatusIcon";
import { RingSheet } from "./RingSheet";

export interface OverviewScreenProps {
  schoolName: string;
  role: HomeAccessRole;
  connection: SchoolBellConnection;
  clock: DeviceClock;
  schedule: SchedulePackState;
  onOpenSchedule: () => void;
  onOpenAnnounce: () => void;
}

export function OverviewScreen({ schoolName, role, connection, clock, schedule, onOpenSchedule, onOpenAnnounce }: OverviewScreenProps) {
  const [ringOpen, setRingOpen] = useState(false);
  const [togglingAutomation, setTogglingAutomation] = useState(false);

  const activeProfile = getActiveProfile(schedule.pack);
  const weekday = clock.now ? clock.now.getDay() : null;
  const todays = weekday === null ? [] : getTodaysSchedules(activeProfile, weekday);
  const nowHHMM = clock.now
    ? `${String(clock.now.getHours()).padStart(2, "0")}:${String(clock.now.getMinutes()).padStart(2, "0")}`
    : null;
  const nextBell = nowHHMM ? findNextBell(todays, nowHHMM) : null;
  const bellsPassed = nowHHMM ? todays.filter((entry) => entry.time < nowHHMM).length : 0;

  async function toggleAutomation() {
    if (!connection.baseUrl || !schedule.pack) return;
    setTogglingAutomation(true);
    try {
      await setAutomationEnabled(connection.baseUrl, !schedule.pack.automation_enabled);
      schedule.reload();
    } finally {
      setTogglingAutomation(false);
    }
  }

  return (
    <div className="sb-page">
      <div className="sb-head">
        <div className="hi">
          <h1>{schoolName}</h1>
          <p>{connection.mode === "local" ? "Connected on local Wi-Fi" : "Not connected"}</p>
        </div>
        <div className="sp" />
        <ConnectionStatusIcon
          canEdit={role === "owner" || role === "admin"}
          cloudEnabled={connection.cloudEnabled}
          localAddress={connection.localAddress}
          mode={connection.mode}
          onRetry={connection.retry}
          onSaveLocalAddress={connection.saveLocalAddress}
        />
      </div>

      <div className="sb-clock">
        <div className="day">{clock.now ? clock.now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Bell time unknown"}</div>
        <div className="time">
          {clock.now
            ? clock.now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "--:--:--"}
        </div>
        {!clock.timeValid && clock.status ? <span className="stale">RTC needs a time set</span> : null}
        <div className="row">
          <div className="nb">
            Next bell
            <b>{nextBell ? `${nextBell.time} · ${nextBell.name}` : "None left today"}</b>
          </div>
          <div className="nb" style={{ textAlign: "right" }}>
            Profile
            <b>{activeProfile?.name ?? "—"}</b>
          </div>
        </div>
      </div>

      <button
        className="sb-ring-cta"
        disabled={connection.mode !== "local" || !canRingBell(role)}
        onClick={() => setRingOpen(true)}
        type="button"
      >
        <span className="ic">
          <FiBell size={19} />
        </span>
        <span className="tx">
          <b>Ring the bell now</b>
          <span>Overrides the schedule for one ring</span>
        </span>
        <span className="sp" />
        <FiChevronRight size={15} />
      </button>

      <button
        className="sb-btn ghost"
        disabled={connection.mode !== "local" || !canRingBell(role)}
        onClick={onOpenAnnounce}
        style={{ marginBottom: 16 }}
        type="button"
      >
        <FiMic size={15} /> Live announcement
      </button>

      <div className="sb-stats">
        <div className="sb-stat">
          <div className="k">Bells today</div>
          <div className="v">
            {bellsPassed}
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}> / {todays.length}</span>
          </div>
        </div>
        <div className="sb-stat">
          <div className="k">Holiday today</div>
          <div className="v" style={{ fontSize: 15 }}>
            {clock.status?.holiday_today ? "Yes — bells paused" : "No"}
          </div>
        </div>
      </div>

      <div className="sb-sec">
        <h3>Automatic bells</h3>
        <button
          className={`sb-switch ${schedule.pack?.automation_enabled ? "on" : ""}`}
          disabled={role === "viewer" || role === "member" || togglingAutomation || connection.mode !== "local"}
          onClick={toggleAutomation}
          type="button"
        />
      </div>

      <div className="sb-sec">
        <h3>Today's schedule</h3>
        <a onClick={onOpenSchedule}>See all</a>
      </div>
      <div className="sb-card">
        {todays.length === 0 ? (
          <div className="sb-empty" style={{ padding: 24 }}>
            {schedule.loading ? "Loading…" : "No bells scheduled today."}
          </div>
        ) : (
          todays.slice(0, 4).map((entry) => (
            <div className="sb-row" key={entry.id}>
              <div className="swatch">{entry.time}</div>
              <div className="body">
                <div className="t">{entry.name}</div>
                <div className="s">
                  {entry.sound_id} · {entry.duration}s
                </div>
              </div>
              <div className="r">
                <span style={{ fontSize: 10, fontWeight: 800, color: entry === nextBell ? "var(--warning)" : "var(--success)" }}>
                  {entry === nextBell ? "UPCOMING" : entry.time < (nowHHMM ?? "") ? "DONE" : ""}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <RingSheet baseUrl={connection.baseUrl} onClose={() => setRingOpen(false)} onRung={() => schedule.reload()} open={ringOpen} />
    </div>
  );
}
