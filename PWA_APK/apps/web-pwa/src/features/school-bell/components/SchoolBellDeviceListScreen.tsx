import type { AuthSession } from "@jenix/shared";
import { useEffect, useState } from "react";
import { FiChevronRight } from "react-icons/fi";

import { listSchoolBellDevices } from "../services/schoolBellDevices";
import type { ManagedDeviceSummary } from "../../devices/services/deviceManagementApi";

export interface SchoolBellDeviceListScreenProps {
  session: AuthSession;
  onSelect: (deviceId: string) => void;
}

/** Same list -> auto-forward-if-one pattern as QrunlockRemoteApp's device list screen. */
export function SchoolBellDeviceListScreen({ session, onSelect }: SchoolBellDeviceListScreenProps) {
  const [devices, setDevices] = useState<ManagedDeviceSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    listSchoolBellDevices(session)
      .then((result) => {
        if (!active) return;
        setDevices(result);
        if (result.length === 1) onSelect(result[0]!.deviceId);
      })
      .catch(() => {
        if (active) setDevices([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (devices === null) {
    return <div className="sb-page sb-empty">Loading your School Bell devices…</div>;
  }

  if (devices.length === 0) {
    return <div className="sb-page sb-empty">No School Bell devices on this home yet. Add one from Home.</div>;
  }

  return (
    <div className="sb-page">
      <div className="sb-head">
        <div className="hi">
          <h1>School Bell devices</h1>
        </div>
      </div>
      <div className="sb-card">
        {devices.map((device) => (
          <button
            className="sb-row clickable"
            key={device.deviceId}
            onClick={() => onSelect(device.deviceId)}
            style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
            type="button"
          >
            <div className="body">
              <div className="t">{device.displayName}</div>
              <div className="s">{device.online ? "Online" : "Offline"}</div>
            </div>
            <div className="r">
              <FiChevronRight color="var(--faint)" size={15} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
