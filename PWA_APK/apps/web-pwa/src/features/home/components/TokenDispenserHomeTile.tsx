import { useState } from "react";
import type { AuthSession } from "@jenix/shared";

import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import { printNext } from "../../token-dispenser/services/tokenDispenserApi";
import { StatusChip } from "./StatusChip";

export interface TokenDispenserHomeTileProps {
  session: AuthSession;
  device: DashboardDevice;
  onOpen: () => void;
  onToast: (message: string) => void;
}

/**
 * Token Dispenser's compact "Icon Card" for the Home grid -- same shell
 * (qr-home-* classes in theme/home.css) and same footprint as
 * QrunlockHomeTile, per DEVICE_PACKAGE_RUNTIME.md's rule that every new
 * device gets the same-size compact tile rather than DeviceTile's
 * tank/flow/pump shape. This is the pattern to copy for the next device:
 * reuse the qr-home-* classes, add the PID to COMPACT_TILE_PIDS in
 * HomeDeviceSection.tsx, and register the tile component there.
 */
export function TokenDispenserHomeTile({
  session,
  device,
  onOpen,
  onToast
}: TokenDispenserHomeTileProps) {
  const [printing, setPrinting] = useState(false);

  async function handlePrint(event: React.MouseEvent) {
    event.stopPropagation();
    if (printing) return;

    setPrinting(true);
    try {
      await printNext(session, device.deviceId);
    } catch {
      onToast("Couldn't print — check your connection and try again");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <article className="qr-home-tile" onClick={onOpen}>
      <div className="qr-home-th">
        <span className="qr-home-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V3h12v6" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        </span>
        <StatusChip status={device.online ? "online" : "offline"} label={device.online ? "Online" : "Offline"} />
      </div>
      <div className="qr-home-nm">{device.displayName}</div>
      <div className="qr-home-row">
        <div className="qr-home-state">
          <span className="qr-home-word is-unlocked">Ready</span>
          <span className="qr-home-sub">{device.telemetryPreview || "Tap to view"}</span>
        </div>
        <button
          className={`qr-home-btn ${printing ? "busy" : ""}`}
          disabled={printing || !device.online}
          onClick={(event) => void handlePrint(event)}
          type="button"
          aria-label={`Print next token on ${device.displayName}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V3h12v6" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
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
