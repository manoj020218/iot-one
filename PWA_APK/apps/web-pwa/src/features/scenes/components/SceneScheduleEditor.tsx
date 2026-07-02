import type { SceneBuilderScheduleDraft } from "../services/sceneBuilder";

export interface SceneScheduleEditorProps {
  schedule: SceneBuilderScheduleDraft;
  hasScheduleTrigger: boolean;
  onChange: (schedule: SceneBuilderScheduleDraft) => void;
}

const scheduleDays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
] as const;

export function SceneScheduleEditor({
  schedule,
  hasScheduleTrigger,
  onChange
}: SceneScheduleEditorProps) {
  function toggleDay(dayValue: number) {
    const hasDay = schedule.daysOfWeek.includes(dayValue);
    onChange({
      ...schedule,
      daysOfWeek: hasDay
        ? schedule.daysOfWeek.filter((day) => day !== dayValue)
        : [...schedule.daysOfWeek, dayValue].sort()
    });
  }

  return (
    <section className="panel scene-section">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Schedule</span>
          <h2>When should schedule triggers run?</h2>
          <p className="hint-text">
            Use this only when at least one trigger is set to schedule.
          </p>
        </div>
      </div>
      <label className="checkbox-row">
        <input
          checked={schedule.enabled}
          type="checkbox"
          onChange={(event) =>
            onChange({
              ...schedule,
              enabled: event.target.checked
            })
          }
        />
        <span>Enable schedule details for this scene</span>
      </label>
      {schedule.enabled ? (
        <div className="scene-form-grid">
          <label className="field">
            <span>Timezone</span>
            <input
              placeholder="Asia/Kolkata"
              value={schedule.timezone}
              onChange={(event) =>
                onChange({
                  ...schedule,
                  timezone: event.target.value
                })
              }
            />
          </label>
          <label className="field">
            <span>Time</span>
            <input
              type="time"
              value={schedule.time}
              onChange={(event) =>
                onChange({
                  ...schedule,
                  time: event.target.value
                })
              }
            />
          </label>
          <div className="field scene-field-span">
            <span>Active Days</span>
            <div className="scene-days-grid">
              {scheduleDays.map((day) => (
                <label className="checkbox-row" key={day.value}>
                  <input
                    checked={schedule.daysOfWeek.includes(day.value)}
                    type="checkbox"
                    onChange={() => toggleDay(day.value)}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {schedule.enabled && !hasScheduleTrigger ? (
        <p className="inline-error">
          Add at least one schedule trigger above so these schedule details can be used.
        </p>
      ) : null}
    </section>
  );
}
