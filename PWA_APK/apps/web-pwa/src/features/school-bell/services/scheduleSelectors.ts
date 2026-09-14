import type { Schedule, SchedulePack, ScheduleProfile } from "./schoolBellTypes";

export function getActiveProfile(pack: SchedulePack | null): ScheduleProfile | null {
  if (!pack) return null;
  return pack.profiles.find((profile) => profile.id === pack.active_profile_id) ?? pack.profiles[0] ?? null;
}

export function getTodaysSchedules(profile: ScheduleProfile | null, weekday: number): Schedule[] {
  if (!profile) return [];
  return profile.schedules
    .filter((schedule) => schedule.enabled && schedule.days.includes(weekday))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** `nowHHMM` as "HH:MM" in the device's own local time — never the phone's. */
export function findNextBell(todaysSchedules: Schedule[], nowHHMM: string): Schedule | null {
  return todaysSchedules.find((schedule) => schedule.time >= nowHHMM) ?? null;
}

export function hasBellPassed(schedule: Schedule, nowHHMM: string): boolean {
  return schedule.time < nowHHMM;
}

export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
