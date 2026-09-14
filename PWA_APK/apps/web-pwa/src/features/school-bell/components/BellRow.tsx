import { DAY_LABELS } from "../services/scheduleSelectors";
import type { Schedule } from "../services/schoolBellTypes";

export interface BellRowProps {
  schedule: Schedule;
  canEdit: boolean;
  onToggleEnabled: () => void;
}

export function BellRow({ schedule, canEdit, onToggleEnabled }: BellRowProps) {
  return (
    <div className="sb-row">
      <div className="swatch">{schedule.time}</div>
      <div className="body">
        <div className="t">{schedule.name}</div>
        <div className="s">
          {schedule.sound_id} · {schedule.duration}s
        </div>
        <div className="sb-daydots" style={{ marginTop: 5 }}>
          {DAY_LABELS.map((label, day) => (
            <span className={schedule.days.includes(day) ? "on" : ""} key={day}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="r">
        <button className={`sb-switch ${schedule.enabled ? "on" : ""}`} disabled={!canEdit} onClick={onToggleEnabled} type="button" />
      </div>
    </div>
  );
}
