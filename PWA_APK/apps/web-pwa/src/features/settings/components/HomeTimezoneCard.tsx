import type { HomeRecord } from "@jenix/shared";
import { useEffect, useState } from "react";

import { homeTimezoneOptions } from "../../homes/constants/homeTimezones";

export interface HomeTimezoneCardProps {
  currentHome: HomeRecord;
  onSave: (timezone: string) => Promise<void> | void;
}

export function HomeTimezoneCard({ currentHome, onSave }: HomeTimezoneCardProps) {
  const [timezone, setTimezone] = useState(currentHome.timezone ?? "Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTimezone(currentHome.timezone ?? "Asia/Kolkata");
  }, [currentHome.homeId, currentHome.timezone]);

  async function handleSave() {
    setSaving(true);
    await onSave(timezone);
    setMessage(`Timezone updated to ${timezone}.`);
    setSaving(false);
  }

  return (
    <section className="panel">
      <div className="home-card-head">
        <strong>Time Zone</strong>
        <span>{currentHome.name}</span>
      </div>
      <label className="field">
        <span>Reporting Time Zone</span>
        <select onChange={(event) => setTimezone(event.target.value)} value={timezone}>
          {homeTimezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="button-row">
        <button className="primary-button" disabled={saving} onClick={() => void handleSave()} type="button">
          {saving ? "Saving..." : "Save Time Zone"}
        </button>
      </div>
      {message ? <p className="hint-text">{message}</p> : null}
    </section>
  );
}
