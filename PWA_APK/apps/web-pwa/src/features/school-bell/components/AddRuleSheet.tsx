import { useEffect, useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import type { CalendarRule, ScheduleProfile } from "../services/schoolBellTypes";

export interface AddRuleSheetProps {
  open: boolean;
  onClose: () => void;
  profiles: ScheduleProfile[];
  nextId: number;
  onAdd: (rule: CalendarRule) => void;
}

export function AddRuleSheet({ open, onClose, profiles, nextId, onAdd }: AddRuleSheetProps) {
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState(20);
  const [repeatYearly, setRepeatYearly] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setProfileId(profiles[0]?.id ?? "");
      setStartDate("");
      setEndDate("");
      setPriority(20);
      setRepeatYearly(false);
    }
  }, [open, profiles]);

  function handleSave() {
    if (!name.trim() || !profileId || !startDate || !endDate) return;
    onAdd({
      id: nextId,
      name: name.trim(),
      profile_id: profileId,
      start_date: startDate,
      end_date: endDate,
      priority,
      repeat_yearly: repeatYearly,
      days: [0, 1, 2, 3, 4, 5, 6],
      enabled: true
    });
  }

  return (
    <Sheet onClose={onClose} open={open} subtitle="Auto-switch to a timetable profile for a date range" title="Add calendar rule">
      <div className="sb-field">
        <label>Rule name</label>
        <input onChange={(event) => setName(event.target.value)} placeholder="Summer vacation" type="text" value={name} />
      </div>
      <div className="sb-field">
        <label>Switch to profile</label>
        <select onChange={(event) => setProfileId(event.target.value)} value={profileId}>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sb-field">
        <label>Start date</label>
        <input onChange={(event) => setStartDate(event.target.value)} placeholder="YYYY-MM-DD" type="text" value={startDate} />
      </div>
      <div className="sb-field">
        <label>End date</label>
        <input onChange={(event) => setEndDate(event.target.value)} placeholder="YYYY-MM-DD" type="text" value={endDate} />
      </div>
      <div className="sb-field">
        <label>Priority — higher wins overlaps ({priority})</label>
        <input max={100} min={1} onChange={(event) => setPriority(Number(event.target.value))} type="range" value={priority} />
      </div>
      <div className="sb-field">
        <label>
          <input checked={repeatYearly} onChange={(event) => setRepeatYearly(event.target.checked)} type="checkbox" /> Repeats every
          year
        </label>
      </div>
      <button className="sb-btn primary" disabled={!name.trim() || !startDate || !endDate} onClick={handleSave} type="button">
        Save rule
      </button>
    </Sheet>
  );
}
