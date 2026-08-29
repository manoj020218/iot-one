import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import { ApiResponseError } from "../../../app/authenticatedRequest";
import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import { unlockDevice } from "../../qrunlock/services/qrunlockApi";
import { StatusChip } from "./StatusChip";

// Same display-only auto-relock timer as LockHero.tsx on the device's own
// Lock screen (IOT_Device/QRunlock/VPS/API_CONTRACT.md §2) -- deliberately
// not tied to the backend's real relayCooldownMs, which the device detail
// page already documents as a separate, server-enforced concern.
const AUTO_RELOCK_DISPLAY_SECONDS = 10;

export interface QrunlockHomeTileProps {
  session: AuthSession;
  device: DashboardDevice;
  onOpen: () => void;
  onToast: (message: string) => void;
}

/**
 * A compact "Icon Card" for QRunlock on the Home grid -- deliberately not
 * DeviceTile.tsx, which is hardcoded to Tank Guard's tank/flow/pump shape
 * and was previously reused for every PID, fabricating tank-style metrics
 * on a device that has none. Design approved via artifact mockup
 * (see VPS/HANDOFF.md) before this was written.
 */
export function QrunlockHomeTile({ session, device, onOpen, onToast }: QrunlockHomeTileProps) {
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

  async function handleUnlock(event: React.MouseEvent) {
    event.stopPropagation();
    if (state !== "locked") {
      onToast("Relay cooldown active — already unlocking");
      return;
    }

    setState("unlocking");
    try {
      await unlockDevice(session, device.deviceId, { reason: "app" });
      setState("unlocked");
      setRemaining(AUTO_RELOCK_DISPLAY_SECONDS);

      tickTimer.current = setInterval(() => {
        setRemaining((value) => (value > 0 ? value - 1 : 0));
      }, 1000);

      relockTimer.current = setTimeout(() => {
        clearInterval(tickTimer.current);
        setState("locked");
      }, AUTO_RELOCK_DISPLAY_SECONDS * 1000);
    } catch (error) {
      setState("locked");
      if (error instanceof ApiResponseError && error.code === "UNLOCK_COOLDOWN_ACTIVE") {
        onToast("Relay is still on cooldown — try again in a moment");
        return;
      }
      onToast("Couldn't unlock — check your connection and try again");
    }
  }

  const isLocked = state === "locked";
  const wordText = isLocked ? "Locked" : state === "unlocking" ? "Unlocking…" : "Unlocked";
  const subText = state === "unlocked" ? `Relocks in ${remaining}s` : "Just now";

  return (
    <article className="qr-home-tile" onClick={onOpen}>
      <div className="qr-home-th">
        <span className="qr-home-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2"></rect>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
          </svg>
        </span>
        <StatusChip status={device.online ? "online" : "offline"} label={device.online ? "Online" : "Offline"} />
      </div>
      <div className="qr-home-nm">{device.displayName}</div>
      <div className="qr-home-row">
        <div className="qr-home-state">
          <span className={`qr-home-word ${isLocked ? "is-locked" : "is-unlocked"}`}>{wordText}</span>
          <span className="qr-home-sub">{subText}</span>
        </div>
        <button
          className={`qr-home-btn ${state === "unlocking" ? "busy" : ""}`}
          disabled={state === "unlocking"}
          onClick={(event) => void handleUnlock(event)}
          type="button"
          aria-label={`Unlock ${device.displayName}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2"></rect>
            <path d="M8 11V7a4 4 0 0 1 7-2.6"></path>
          </svg>
          <span className="qr-home-spinner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" opacity="0.25"></circle>
              <path d="M21 12a9 9 0 0 0-9-9"></path>
            </svg>
          </span>
        </button>
      </div>
    </article>
  );
}
