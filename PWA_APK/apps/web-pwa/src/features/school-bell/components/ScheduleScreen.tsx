import type { HomeAccessRole } from "@jenix/shared";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";

import { activateProfile } from "../services/schoolBellLocalApi";
import { canManageSchedule } from "../services/schoolBellRoles";
import type { CalendarRule, Schedule } from "../services/schoolBellTypes";
import type { SchedulePackState } from "../services/useSchedulePack";
import { AddBellSheet } from "./AddBellSheet";
import { AddRuleSheet } from "./AddRuleSheet";
import { BellRow } from "./BellRow";
import { CalendarRuleRow } from "./CalendarRuleRow";

export interface ScheduleScreenProps {
  role: HomeAccessRole;
  baseUrl: string | null;
  schedule: SchedulePackState;
}

export function ScheduleScreen({ role, baseUrl, schedule }: ScheduleScreenProps) {
  const { pack } = schedule;
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [addBellOpen, setAddBellOpen] = useState(false);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const canEdit = canManageSchedule(role) && Boolean(baseUrl);

  if (!pack) {
    return <div className="sb-page sb-empty">{schedule.loading ? "Loading schedule…" : schedule.error ?? "Not connected."}</div>;
  }

  const activeId = selectedProfileId ?? pack.active_profile_id;
  const profile = pack.profiles.find((entry) => entry.id === activeId) ?? pack.profiles[0] ?? null;
  const allScheduleIds = pack.profiles.flatMap((entry) => entry.schedules.map((item) => item.id));
  const nextBellId = allScheduleIds.length ? Math.max(...allScheduleIds) + 1 : 1;
  const nextRuleId = pack.calendar_rules.length ? Math.max(...pack.calendar_rules.map((rule) => rule.id)) + 1 : 1;

  async function setActive(profileId: string) {
    setSelectedProfileId(profileId);
    if (!baseUrl || !canEdit) return;
    await activateProfile(baseUrl, profileId);
    schedule.reload();
  }

  async function toggleBell(scheduleId: number) {
    if (!pack || !profile) return;
    const next = {
      ...pack,
      profiles: pack.profiles.map((entry) =>
        entry.id !== profile.id
          ? entry
          : {
              ...entry,
              schedules: entry.schedules.map((item) => (item.id === scheduleId ? { ...item, enabled: !item.enabled } : item))
            }
      )
    };
    await schedule.save(next);
  }

  async function addBell(newSchedule: Schedule) {
    if (!pack || !profile) return;
    const next = {
      ...pack,
      profiles: pack.profiles.map((entry) => (entry.id !== profile.id ? entry : { ...entry, schedules: [...entry.schedules, newSchedule] }))
    };
    await schedule.save(next);
    setAddBellOpen(false);
  }

  async function addRule(rule: CalendarRule) {
    if (!pack) return;
    const next = { ...pack, calendar_rules: [...pack.calendar_rules, rule] };
    await schedule.save(next);
    setAddRuleOpen(false);
  }

  return (
    <div className="sb-page">
      <div className="sb-head">
        <div className="hi">
          <h1>Schedule</h1>
          <p>Timetable profiles &amp; auto-switch rules</p>
        </div>
      </div>

      <div className="sb-tabs">
        {pack.profiles.map((entry) => (
          <button className={entry.id === activeId ? "on" : ""} key={entry.id} onClick={() => setActive(entry.id)} type="button">
            {entry.name}
          </button>
        ))}
      </div>

      <div className="sb-sec" style={{ position: "relative" }}>
        <h3>
          {profile?.name} · {profile?.schedules.length ?? 0} bells
        </h3>
        {canEdit ? (
          <button className="sb-iconbtn" onClick={() => setAddBellOpen(true)} type="button">
            <FiPlus size={15} />
          </button>
        ) : null}
      </div>

      {profile && profile.schedules.length > 0 ? (
        <div className="sb-card">
          {profile.schedules.map((entry) => (
            <BellRow canEdit={canEdit} key={entry.id} onToggleEnabled={() => toggleBell(entry.id)} schedule={entry} />
          ))}
        </div>
      ) : (
        <div className="sb-empty">No bells configured for {profile?.name} yet.</div>
      )}

      <div className="sb-sec" style={{ marginTop: 22 }}>
        <h3>Calendar rules</h3>
      </div>
      {pack.calendar_rules.map((rule) => (
        <CalendarRuleRow key={rule.id} profiles={pack.profiles} rule={rule} />
      ))}
      {canEdit ? (
        <button className="sb-btn ghost" onClick={() => setAddRuleOpen(true)} style={{ marginTop: 2 }} type="button">
          <FiPlus size={15} /> Add calendar rule
        </button>
      ) : null}

      <AddBellSheet baseUrl={baseUrl} nextId={nextBellId} onAdd={addBell} onClose={() => setAddBellOpen(false)} open={addBellOpen} />
      <AddRuleSheet nextId={nextRuleId} onAdd={addRule} onClose={() => setAddRuleOpen(false)} open={addRuleOpen} profiles={pack.profiles} />
    </div>
  );
}
