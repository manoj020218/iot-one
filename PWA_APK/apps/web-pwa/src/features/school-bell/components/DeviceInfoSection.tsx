import type { HomeAccessRole } from "@jenix/shared";
import { FiClock } from "react-icons/fi";

import type { DeviceClock } from "../services/useDeviceClock";
import type { SchoolBellConnection } from "../services/useSchoolBellConnection";

export interface DeviceInfoSectionProps {
  role: HomeAccessRole;
  connection: SchoolBellConnection;
  clock: DeviceClock;
  onSetTime: () => void;
}

/** Split out of SettingsScreen.tsx to keep it under the project's 200-line rule. */
export function DeviceInfoSection({ role, connection, clock, onSetTime }: DeviceInfoSectionProps) {
  return (
    <>
      <div className="sb-sec">
        <h3>Device info</h3>
      </div>
      <div className="sb-card">
        <div className="sb-row">
          <div className="swatch">
            <FiClock size={16} />
          </div>
          <div className="body">
            <div className="t">Bell's own time (RTC)</div>
            <div className="s">
              {clock.now ? clock.now.toLocaleString() : "Unknown"} {clock.timeValid ? "" : "· not set"}
            </div>
          </div>
          {role === "owner" || role === "admin" ? (
            <div className="r">
              <button className="sb-btn ghost" disabled={connection.mode !== "local"} onClick={onSetTime} type="button">
                Set
              </button>
            </div>
          ) : null}
        </div>
        <div className="sb-row">
          <div className="body">
            <div className="t">Firmware</div>
          </div>
          <div className="r" style={{ color: "var(--muted)", fontSize: 12.5 }}>
            {clock.status?.firmware_version ?? "—"}
          </div>
        </div>
        <div className="sb-row">
          <div className="body">
            <div className="t">Internal storage</div>
          </div>
          <div className="r" style={{ color: "var(--muted)", fontSize: 12.5 }}>
            {clock.status?.internal_storage
              ? `${(clock.status.internal_storage.free_bytes / (1024 * 1024)).toFixed(1)} MB free`
              : clock.status?.internal_storage_ready
                ? "Ready"
                : "Not ready"}
          </div>
        </div>
        <div className="sb-row">
          <div className="body">
            <div className="t">SD card</div>
          </div>
          <div className="r" style={{ color: "var(--muted)", fontSize: 12.5 }}>
            {clock.status?.sd_ready ? "Inserted" : "Not inserted (optional)"}
          </div>
        </div>
      </div>
    </>
  );
}
