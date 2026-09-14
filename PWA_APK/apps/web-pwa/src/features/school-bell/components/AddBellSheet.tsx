import { useEffect, useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import { formatBytes } from "../services/formatBytes";
import { getSounds, getStatus } from "../services/schoolBellLocalApi";
import type { Schedule, Sound } from "../services/schoolBellTypes";

export interface AddBellSheetProps {
  open: boolean;
  onClose: () => void;
  baseUrl: string | null;
  nextId: number;
  onAdd: (schedule: Schedule) => void;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function AddBellSheet({ open, onClose, baseUrl, nextId, onAdd }: AddBellSheetProps) {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [soundId, setSoundId] = useState("");
  const [duration, setDuration] = useState(5);
  const [days, setDays] = useState<number[]>(WEEKDAYS);

  useEffect(() => {
    if (!open || !baseUrl) return;
    getSounds(baseUrl)
      .then((result) => {
        setSounds(result.sounds);
        if (result.sounds[0]) setSoundId(result.sounds[0].id);
      })
      .catch(() => setSounds([]));
    getStatus(baseUrl)
      .then((status) => setFreeBytes(status.internal_storage?.free_bytes ?? null))
      .catch(() => setFreeBytes(null));
  }, [open, baseUrl]);

  useEffect(() => {
    if (open) {
      setName("");
      setTime("08:00");
      setDuration(5);
      setDays(WEEKDAYS);
    }
  }, [open]);

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  }

  function handleSave() {
    if (!name.trim() || !soundId) return;
    onAdd({ id: nextId, name: name.trim(), time, type: "custom", sound_id: soundId, duration, days, enabled: true });
  }

  return (
    <Sheet onClose={onClose} open={open} subtitle="Added to the currently selected timetable" title="Add bell">
      <div className="sb-field">
        <label>Name</label>
        <input onChange={(event) => setName(event.target.value)} placeholder="e.g. Second Bell" type="text" value={name} />
      </div>
      <div className="sb-field">
        <label>Time</label>
        <input onChange={(event) => setTime(event.target.value)} type="text" value={time} />
      </div>
      <div className="sb-field">
        <label>
          Sound{freeBytes !== null ? ` — ${formatBytes(freeBytes)} free on the device for new ones` : ""}
        </label>
        <select onChange={(event) => setSoundId(event.target.value)} value={soundId}>
          {sounds.map((sound) => (
            <option key={sound.id} value={sound.id}>
              {sound.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sb-field">
        <label>Duration — {duration}s</label>
        <input max={60} min={1} onChange={(event) => setDuration(Number(event.target.value))} type="range" value={duration} />
      </div>
      <div className="sb-field">
        <label>Repeat on</label>
        <div className="sb-daypick">
          {ALL_DAYS.map((day) => (
            <button className={days.includes(day) ? "on" : ""} key={day} onClick={() => toggleDay(day)} type="button">
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>
      <button className="sb-btn primary" disabled={!name.trim() || !soundId} onClick={handleSave} type="button">
        Save bell
      </button>
    </Sheet>
  );
}
