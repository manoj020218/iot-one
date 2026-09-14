import { useEffect, useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import { getPresets, ringBell } from "../services/schoolBellLocalApi";
import type { BellPreset } from "../services/schoolBellTypes";

export interface RingSheetProps {
  open: boolean;
  onClose: () => void;
  baseUrl: string | null;
  onRung: () => void;
}

/** Manual ring — the one action a Member (not just Admin/Owner) can take, per the approved role model. */
export function RingSheet({ open, onClose, baseUrl, onRung }: RingSheetProps) {
  const [presets, setPresets] = useState<BellPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | "custom">("custom");
  const [duration, setDuration] = useState(10);
  const [ringing, setRinging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !baseUrl) return;
    getPresets(baseUrl)
      .then((result) => {
        setPresets(result.presets);
        if (result.presets[0]) {
          setSelectedId(result.presets[0].id);
          setDuration(result.presets[0].duration);
        }
      })
      .catch(() => setPresets([]));
  }, [open, baseUrl]);

  const selectedPreset = presets.find((preset) => preset.id === selectedId);

  async function handleRing() {
    if (!baseUrl || !selectedPreset) return;
    setRinging(true);
    setError(null);
    try {
      await ringBell(baseUrl, { name: selectedPreset.label, soundId: selectedPreset.sound_id, duration });
      onRung();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ring failed");
    } finally {
      setRinging(false);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      open={open}
      subtitle="Overrides the schedule for one ring"
      title="Ring the bell"
    >
      <div className="sb-field">
        <label>Quick pick</label>
        <div className="sb-chiprow">
          {presets.map((preset) => (
            <button
              className={`sb-pickchip ${preset.id === selectedId ? "on" : ""}`}
              key={preset.id}
              onClick={() => {
                setSelectedId(preset.id);
                setDuration(preset.duration);
              }}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="sb-field">
        <label>Duration — {duration}s</label>
        <input
          max={60}
          min={2}
          onChange={(event) => setDuration(Number(event.target.value))}
          type="range"
          value={duration}
        />
      </div>
      {error ? <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p> : null}
      <button className="sb-btn primary" disabled={!baseUrl || !selectedPreset || ringing} onClick={handleRing} type="button">
        {ringing ? "Ringing…" : "Ring now"}
      </button>
    </Sheet>
  );
}
