import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import { ApiResponseError } from "../../../app/authenticatedRequest";
import { unlockDevice } from "../services/qrunlockApi";

const RING_CIRCUMFERENCE = 2 * Math.PI * 130;
// How long the UI shows "recently unlocked" (red, counting down) before
// snapping back to "Locked" (green). This is a display-only timer,
// deliberately separate from the backend's own relayCooldownMs (which
// governs when a second relay pulse is actually allowed) — see
// IOT_Device/QRunlock/VPS/API_CONTRACT.md §2.
const AUTO_RELOCK_DISPLAY_SECONDS = 10;

export interface LockHeroProps {
  session: AuthSession;
  deviceId: string;
  onUnlocked?: () => void;
  onToast: (message: string) => void;
}

export function LockHero({ session, deviceId, onUnlocked, onToast }: LockHeroProps) {
  const [state, setState] = useState<"locked" | "unlocking" | "unlocked">("locked");
  const [remaining, setRemaining] = useState(AUTO_RELOCK_DISPLAY_SECONDS);
  const relockTimer = useRef<ReturnType<typeof setTimeout>>();
  const tickTimer = useRef<ReturnType<typeof setInterval>>();

  useEffect(
    () => () => {
      clearTimeout(relockTimer.current);
      clearInterval(tickTimer.current);
    },
    []
  );

  async function handleTap() {
    if (state !== "locked") {
      onToast("Relay cooldown active — already unlocking");
      return;
    }

    setState("unlocking");
    try {
      const result = await unlockDevice(session, deviceId, { reason: "app" });
      setState("unlocked");
      setRemaining(AUTO_RELOCK_DISPLAY_SECONDS);
      onUnlocked?.();

      tickTimer.current = setInterval(() => {
        setRemaining((value) => (value > 0 ? value - 1 : 0));
      }, 1000);

      relockTimer.current = setTimeout(() => {
        clearInterval(tickTimer.current);
        setState("locked");
      }, AUTO_RELOCK_DISPLAY_SECONDS * 1000);

      void result;
    } catch (error) {
      setState("locked");
      if (error instanceof ApiResponseError && error.code === "UNLOCK_COOLDOWN_ACTIVE") {
        onToast("Relay is still on cooldown — try again in a moment");
        return;
      }
      onToast("Couldn't unlock — check your connection and try again");
    }
  }

  const isUnlocked = state === "unlocked";
  const isLocked = state === "locked";

  return (
    <div className="qr-lock-hero">
      <div className="qr-ring-wrap">
        <svg className="track" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="130" fill="none" stroke="var(--line)" strokeWidth="5" />
          <circle
            cx="140"
            cy="140"
            r="130"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={isUnlocked ? RING_CIRCUMFERENCE * (remaining / AUTO_RELOCK_DISPLAY_SECONDS) : RING_CIRCUMFERENCE}
            style={{ transition: isUnlocked ? "stroke-dashoffset 1s linear" : "none" }}
          />
        </svg>
        <button
          className={`qr-lock-btn ${isLocked ? "is-locked" : "is-unlocked"}`}
          disabled={state === "unlocking"}
          onClick={() => void handleTap()}
          type="button"
        >
          <span className="icon-wrap">
            {isLocked ? (
              <svg fill="none" height="52" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="52">
                <rect height="10" rx="2.4" width="15" x="4.5" y="10.5" />
                <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                <circle cx="12" cy="15.3" fill="currentColor" r="1.5" stroke="none" />
              </svg>
            ) : (
              <svg fill="none" height="52" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="52">
                <rect height="10" rx="2.4" width="15" x="4.5" y="10.5" />
                <path d="M8 10.5V7.7a4 4 0 0 1 7.4-2.1" />
                <circle cx="12" cy="15.3" fill="currentColor" r="1.5" stroke="none" />
              </svg>
            )}
          </span>
        </button>
      </div>
      <div className={`qr-state-label ${isLocked ? "is-locked" : "is-unlocked"}`}>
        {isLocked ? "Locked" : state === "unlocking" ? "Unlocking…" : "Unlocked"}
      </div>
      <div className="qr-lock-helper">
        {isUnlocked ? (
          <>
            auto-locks in <span className="cd">{remaining}s</span>
          </>
        ) : (
          "touch to unlock"
        )}
      </div>
    </div>
  );
}
