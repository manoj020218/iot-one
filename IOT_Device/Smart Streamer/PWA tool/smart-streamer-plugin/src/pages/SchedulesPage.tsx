import { React } from "../host";
import { DEMO_STREAMER_SCHEDULES } from "../demoSchedules";

interface SchedulesPageProps {
  onOpenSchedule: (scheduleId: string) => void;
  onAddSchedule: () => void;
}

export function SchedulesPage({ onOpenSchedule, onAddSchedule }: SchedulesPageProps) {
  return (
    <section>
      <div className="scene-section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="hint-text">
            Demo data — replace with GET /api/v1/streamer/schedules once the VPS module
            ships. Each of these is stored as a paired start/stop Scene under the hood
            (see VPS/API_CONTRACT.md §4) — this page never needs to know that.
          </p>
        </div>
        <button className="primary-button" onClick={onAddSchedule} type="button">
          Add Schedule
        </button>
      </div>
      <div className="content-grid">
        {DEMO_STREAMER_SCHEDULES.map((schedule) => (
          <article className="device-card" key={schedule.scheduleId}>
            <div className="device-card-head">
              <div className="device-icon">{schedule.startLocalTime.slice(0, 2)}h</div>
              <div>
                <p className="device-pid-label">
                  {schedule.startLocalTime}–{schedule.stopLocalTime} · {schedule.timezone}
                </p>
                <p className="device-pid-code">{schedule.scheduleId}</p>
              </div>
            </div>
            <div>
              <h3>{schedule.name}</h3>
              <p>{schedule.daysOfWeek.join(", ")}</p>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>Device</dt>
                <dd>{schedule.deviceId}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{schedule.priority}</dd>
              </div>
            </dl>
            <div className="card-actions">
              <span>{schedule.enabled ? "Enabled" : "Disabled"}</span>
              <button
                className="text-button"
                onClick={() => onOpenSchedule(schedule.scheduleId)}
                type="button"
              >
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
