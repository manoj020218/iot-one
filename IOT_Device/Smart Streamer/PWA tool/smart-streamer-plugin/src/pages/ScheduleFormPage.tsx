import { React } from "../host";
import { DEMO_STREAMER_SCHEDULES, WEEKDAYS } from "../demoSchedules";
import { TextField } from "../components/FormFields";

interface ScheduleFormPageProps {
  scheduleId: string | null;
  onBack: () => void;
}

export function ScheduleFormPage({ scheduleId, onBack }: ScheduleFormPageProps) {
  const existing = scheduleId
    ? DEMO_STREAMER_SCHEDULES.find((schedule) => schedule.scheduleId === scheduleId)
    : undefined;

  const [name, setName] = React.useState(existing?.name ?? "");
  const [deviceId, setDeviceId] = React.useState(existing?.deviceId ?? "");
  const [cameraId, setCameraId] = React.useState(existing?.cameraId ?? "");
  const [destinationId, setDestinationId] = React.useState(existing?.destinationId ?? "");
  const [timezone, setTimezone] = React.useState(existing?.timezone ?? "Asia/Kolkata");
  const [startTime, setStartTime] = React.useState(existing?.startLocalTime ?? "18:00");
  const [stopTime, setStopTime] = React.useState(existing?.stopLocalTime ?? "19:00");
  const [days, setDays] = React.useState<string[]>(existing?.daysOfWeek ?? []);

  function toggleDay(day: string): void {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  return (
    <section>
      <button className="text-button" onClick={onBack} style={{ marginBottom: 12 }} type="button">
        ← Back to Schedules
      </button>

      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">{scheduleId ? "Edit Schedule" : "Add Schedule"}</span>
            <h2 style={{ marginBottom: 4 }}>{name || "New Schedule"}</h2>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <TextField label="Schedule Name" onChange={setName} value={name} />
          <TextField label="Device ID" onChange={setDeviceId} value={deviceId} />
          <TextField label="Camera ID" onChange={setCameraId} value={cameraId} />
          <TextField label="Destination ID" onChange={setDestinationId} value={destinationId} />
          <TextField label="Timezone" onChange={setTimezone} value={timezone} />
          <TextField label="Start Time" onChange={setStartTime} value={startTime} />
          <TextField label="Stop Time" onChange={setStopTime} value={stopTime} />
        </div>

        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, color: "var(--faint)" }}>Days of Week</span>
          <div className="card-actions" style={{ justifyContent: "flex-start", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {WEEKDAYS.map((day) => (
              <button
                className={days.includes(day) ? "primary-button" : "text-button"}
                key={day}
                onClick={() => toggleDay(day)}
                type="button"
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <p className="hint-text" style={{ marginTop: 12 }}>
          Stored server-side as a paired start/stop Scene (VPS/API_CONTRACT.md §4).
          Overlapping schedules for the same device are rejected with SCHEDULE_CONFLICT.
        </p>

        <div className="card-actions" style={{ marginTop: 12 }}>
          <button className="text-button" disabled type="button">
            Run Now
          </button>
          <button className="text-button" disabled type="button">
            {scheduleId ? "Save Changes" : "Create Schedule"}
          </button>
        </div>
      </article>
    </section>
  );
}
