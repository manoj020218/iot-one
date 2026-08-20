import { useEffect, useState } from "react";

import { useAuth } from "../auth/hooks/useAuth";
import { listManagedDevices } from "../devices/services/deviceManagementApi";
import { QRUNLOCK_PID } from "./qrunlockPid";

/**
 * Fail-closed, same interim approach as
 * features/streamer/useHasSmartStreamerDevice.ts: returns false while
 * loading and on any error, pays for a full device-list fetch to answer
 * one boolean. Replace both once a cheap /api/v1/homes/:homeId/pid-families
 * check exists.
 */
export function useHasQrunlockDevice(): boolean {
  const { session } = useAuth();
  const [hasDevice, setHasDevice] = useState(false);

  useEffect(() => {
    if (!session) {
      setHasDevice(false);
      return;
    }

    let active = true;

    void listManagedDevices(session)
      .then((devices) => {
        if (active) {
          setHasDevice(devices.some((device) => device.pid === QRUNLOCK_PID));
        }
      })
      .catch(() => {
        if (active) {
          setHasDevice(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

  return hasDevice;
}
