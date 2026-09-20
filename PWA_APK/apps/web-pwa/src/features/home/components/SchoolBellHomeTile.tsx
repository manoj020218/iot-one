import { FiVolume2 } from "react-icons/fi";
import type { AuthSession } from "@jenix/shared";

import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import { StatusChip } from "./StatusChip";

export interface SchoolBellHomeTileProps {
  session: AuthSession;
  device: DashboardDevice;
  onOpen: () => void;
  onToast: (message: string) => void;
}

/**
 * School Bell's compact "Icon Card" for the Home grid -- same shell
 * (qr-home-* classes in theme/home.css) as QrunlockHomeTile/
 * TokenDispenserHomeTile, per DEVICE_PACKAGE_RUNTIME.md's rule that every
 * device gets the same-size compact tile rather than DeviceTile's
 * tank/flow/pump shape, which was rendering fabricated tank-gauge/litre/
 * flow data for this device before it was registered here (it fell through
 * to DeviceTile.tsx's generic fallback, the same gap QRunlock and Token
 * Dispenser were pulled out of earlier).
 */
export function SchoolBellHomeTile({ device, onOpen }: SchoolBellHomeTileProps) {
  return (
    <article className="qr-home-tile" onClick={onOpen}>
      <div className="qr-home-th">
        <span className="qr-home-icon" aria-hidden="true">
          <FiVolume2 size={20} />
        </span>
        <StatusChip
          status={device.online ? "online" : "offline"}
          label={device.online ? "Online" : "Offline"}
        />
      </div>
      <div className="qr-home-nm">{device.displayName}</div>
      <div className="qr-home-row">
        <div className="qr-home-state">
          <span className="qr-home-word is-unlocked">Ready</span>
          <span className="qr-home-sub">{device.telemetryPreview || "Tap to view"}</span>
        </div>
      </div>
    </article>
  );
}
