import type { AuthSession } from "@jenix/shared";
import { getCurrentHome } from "@jenix/shared";
import { useState } from "react";

import type { ManagedDeviceSummary } from "../../devices/services/deviceManagementApi";
import { useDeviceClock } from "../services/useDeviceClock";
import { useDeviceConfig } from "../services/useDeviceConfig";
import { useSchedulePack } from "../services/useSchedulePack";
import { useSchoolBellConnection } from "../services/useSchoolBellConnection";
import { AnnounceScreen } from "./AnnounceScreen";
import { FestivalScreen } from "./FestivalScreen";
import { HolidaysScreen } from "./HolidaysScreen";
import { LogsScreen } from "./LogsScreen";
import { MoreScreen } from "./MoreScreen";
import { OverviewScreen } from "./OverviewScreen";
import { ScheduleScreen } from "./ScheduleScreen";
import { SettingsScreen } from "./SettingsScreen";
import { SoundsScreen } from "./SoundsScreen";

export interface SchoolBellShellProps {
  session: AuthSession;
  device: ManagedDeviceSummary;
}

type TopTab = "overview" | "schedule" | "sounds" | "more";
type MoreSubScreen = "holidays" | "logs" | "settings" | "festival" | "announce" | null;

const TABS: { key: TopTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "Schedule" },
  { key: "sounds", label: "Sounds" },
  { key: "more", label: "More" }
];

/**
 * The whole plugin's internal shell — everything below the platform's
 * real global nav (see the studio note in the approved mockup). Owns the
 * one connection/clock/schedule/config state so every screen shares it
 * instead of each re-fetching independently.
 */
export function SchoolBellShell({ session, device }: SchoolBellShellProps) {
  const home = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);
  const role = home.role;
  const [tab, setTab] = useState<TopTab>("overview");
  const [moreSub, setMoreSub] = useState<MoreSubScreen>(null);

  const connection = useSchoolBellConnection(device.deviceId);
  const clock = useDeviceClock(connection.baseUrl);
  const schedule = useSchedulePack(connection.baseUrl);
  const config = useDeviceConfig(connection.baseUrl);

  function selectTab(next: TopTab) {
    setMoreSub(null);
    setTab(next);
  }

  if (moreSub === "holidays") {
    return <HolidaysScreen baseUrl={connection.baseUrl} onBack={() => setMoreSub(null)} role={role} />;
  }
  if (moreSub === "logs") {
    return <LogsScreen baseUrl={connection.baseUrl} onBack={() => setMoreSub(null)} role={role} />;
  }
  if (moreSub === "settings") {
    return <SettingsScreen clock={clock} config={config} connection={connection} onBack={() => setMoreSub(null)} role={role} />;
  }
  if (moreSub === "festival") {
    return <FestivalScreen baseUrl={connection.baseUrl} onBack={() => setMoreSub(null)} role={role} />;
  }
  if (moreSub === "announce") {
    return <AnnounceScreen baseUrl={connection.baseUrl} onBack={() => setMoreSub(null)} role={role} />;
  }

  return (
    <div>
      <div className="sb-tabs">
        {TABS.map((entry) => (
          <button className={entry.key === tab ? "on" : ""} key={entry.key} onClick={() => selectTab(entry.key)} type="button">
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewScreen
          clock={clock}
          connection={connection}
          onOpenAnnounce={() => setMoreSub("announce")}
          onOpenSchedule={() => selectTab("schedule")}
          role={role}
          schedule={schedule}
          schoolName={config.config?.school_name ?? device.displayName}
        />
      ) : null}
      {tab === "schedule" ? <ScheduleScreen baseUrl={connection.baseUrl} role={role} schedule={schedule} /> : null}
      {tab === "sounds" ? (
        <SoundsScreen
          baseUrl={connection.baseUrl}
          deviceId={device.deviceId}
          freeBytes={clock.status?.internal_storage?.free_bytes ?? null}
          pack={schedule.pack}
          role={role}
        />
      ) : null}
      {tab === "more" ? (
        <MoreScreen
          homeId={home.homeId}
          onOpenAnnounce={() => setMoreSub("announce")}
          onOpenFestival={() => setMoreSub("festival")}
          onOpenHolidays={() => setMoreSub("holidays")}
          onOpenLogs={() => setMoreSub("logs")}
          onOpenSettings={() => setMoreSub("settings")}
        />
      ) : null}
    </div>
  );
}
