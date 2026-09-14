import type { HomeAccessRole } from "@jenix/shared";
import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiMic, FiMicOff } from "react-icons/fi";

import { useAnnouncementStatus } from "../services/announcement/useAnnouncementStatus";
import { useSoftPtt } from "../services/announcement/useSoftPtt";
import { canRingBell } from "../services/schoolBellRoles";

export interface AnnounceScreenProps {
  role: HomeAccessRole;
  baseUrl: string | null;
  onBack: () => void;
}

const STATE_COPY: Record<string, string> = {
  idle: "Hold to talk",
  connecting: "Connecting…",
  "requesting-mic": "Requesting microphone…",
  speaking: "Live — release to stop",
  stopping: "Stopping…",
  error: "Couldn't start"
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Soft Push-to-Talk — press and hold, streams the phone mic to /api/v1/announcement/ws per SOFT_PTT_CONTRACT.md. */
export function AnnounceScreen({ role, baseUrl, onBack }: AnnounceScreenProps) {
  const ptt = useSoftPtt(baseUrl);
  const audioStatus = useAnnouncementStatus(baseUrl, ptt.state === "speaking" ? 3000 : 5000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const hardwarePttLive = audioStatus?.announcement_source === "physical";
  const canTalk = canRingBell(role) && Boolean(baseUrl) && !hardwarePttLive;
  const live = ptt.state === "speaking";
  const busy = ptt.state === "connecting" || ptt.state === "requesting-mic" || ptt.state === "stopping";

  useEffect(() => {
    if (live && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    if (!live) {
      startedAtRef.current = null;
      setElapsedMs(0);
      return;
    }
    const interval = setInterval(() => setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now())), 500);
    return () => clearInterval(interval);
  }, [live]);

  function handlePress() {
    if (!canTalk || busy || live) return;
    ptt.start();
  }

  function handleRelease() {
    if (live) ptt.stop();
  }

  return (
    <div className="sb-page">
      <div className="sb-back">
        <button className="sb-iconbtn" onClick={onBack} type="button">
          <FiArrowLeft size={15} />
        </button>
        <h2>Announce</h2>
      </div>

      {hardwarePttLive ? (
        <div className="sb-info">The hardware mic button at the bell is live right now — soft talk is unavailable until it's released.</div>
      ) : (
        <div className="sb-info">A scheduled bell will pause your announcement, play, then let you keep talking.</div>
      )}

      <div className="sb-talk-wrap">
        <button
          className={`sb-talk-btn ${live ? "live" : ""} ${busy ? "busy" : ""}`}
          disabled={!canTalk || busy}
          onContextMenu={(event) => event.preventDefault()}
          onPointerCancel={handleRelease}
          onPointerDown={handlePress}
          onPointerLeave={handleRelease}
          onPointerUp={handleRelease}
          type="button"
        >
          {live ? <FiMic size={48} /> : <FiMicOff size={48} />}
        </button>
        <div className="sb-talk-label">{ptt.error ?? STATE_COPY[ptt.state]}</div>
        {live ? <div className="sb-talk-timer">{formatElapsed(elapsedMs)}</div> : null}
        {!canTalk && !hardwarePttLive ? (
          <div className="sb-talk-sub">{baseUrl ? "You don't have permission to announce on this bell." : "Not connected to the bell."}</div>
        ) : null}
      </div>
    </div>
  );
}
