import { useRef, useState } from "react";
import { FiPause, FiPlay, FiTrash2 } from "react-icons/fi";

import { formatBytes } from "../services/formatBytes";
import type { Sound } from "../services/schoolBellTypes";

export interface SoundRowProps {
  sound: Sound;
  previewSrc: string | null;
  usedByCount: number;
  canDelete: boolean;
  onDelete: () => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "length unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const SOURCE_LABEL: Record<Sound["source"], string> = {
  "internal-flash": "Internal",
  "sd-card": "SD card",
  "festival-slot": "Festival"
};

export function SoundRow({ sound, previewSrc, usedByCount, canDelete, onDelete }: SoundRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function togglePlay() {
    if (!previewSrc) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(previewSrc);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  }

  return (
    <div className="sb-row">
      <button className="sb-iconbtn" disabled={!previewSrc} onClick={togglePlay} title={playing ? "Pause" : "Preview"} type="button">
        {playing ? <FiPause size={14} /> : <FiPlay size={14} />}
      </button>
      <div className="body">
        <div className="t">{sound.name}</div>
        <div className="s">
          {SOURCE_LABEL[sound.source]} · {formatDuration(sound.duration)} · {formatBytes(sound.bytes)} ·{" "}
          {usedByCount > 0 ? `Used in ${usedByCount} schedule(s)` : "Not used yet"}
        </div>
      </div>
      {canDelete && usedByCount === 0 && sound.source !== "sd-card" ? (
        <div className="r">
          <button className="sb-iconbtn" onClick={onDelete} style={{ color: "var(--danger)" }} type="button">
            <FiTrash2 size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
