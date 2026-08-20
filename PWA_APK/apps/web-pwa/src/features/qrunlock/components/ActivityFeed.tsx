import { useEffect, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import { listActivity, type QrunlockActivityEvent } from "../services/qrunlockApi";

const TYPE_LABEL: Record<QrunlockActivityEvent["type"], string> = {
  unlock: "Unlocked",
  rf_learn_start: "RF-learn started",
  rf_learn_cancel: "RF-learn cancelled",
  rf_learn_timeout: "RF-learn timed out"
};

function iconClass(type: QrunlockActivityEvent["type"]): string {
  return type === "unlock" ? "unlock" : "learn";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export interface ActivityFeedProps {
  session: AuthSession;
  deviceId: string;
  limit?: number;
  refreshKey?: number;
}

export function ActivityFeed({ session, deviceId, limit, refreshKey }: ActivityFeedProps) {
  const [events, setEvents] = useState<QrunlockActivityEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    setEvents(null);
    listActivity(session, deviceId)
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, deviceId, refreshKey]);

  if (events === null) {
    return <div className="qr-empty">Loading…</div>;
  }

  const rows = limit ? events.slice(0, limit) : events;

  if (rows.length === 0) {
    return <div className="qr-empty">No activity yet — unlock the door once to see it here.</div>;
  }

  return (
    <div className="qr-card">
      {rows.map((event) => (
        <div className="qr-log-row" key={event.eventId}>
          <span className={`lic ${iconClass(event.type)}`}>
            <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
              {event.type === "unlock" ? (
                <>
                  <rect height="10" rx="2.2" width="15" x="4.5" y="10.5" />
                  <path d="M8 10.5V7.7a4 4 0 0 1 7.4-2.1" />
                </>
              ) : (
                <>
                  <path d="M4 8a10 10 0 0 1 16 0" />
                  <path d="M7 11a6 6 0 0 1 10 0" />
                  <circle cx="12" cy="16" r="2" />
                </>
              )}
            </svg>
          </span>
          <span className="lt">
            <span className="a">{TYPE_LABEL[event.type]}</span>
            <span className="b">
              {event.source}
              {event.detail ? ` · ${event.detail}` : ""}
            </span>
          </span>
          <span className="lts">{formatTime(event.occurredAt)}</span>
        </div>
      ))}
    </div>
  );
}
