import { useEffect, useState } from "react";

import { useAuth } from "../auth/hooks/useAuth";
import { listManagedDevices } from "../devices/services/deviceManagementApi";
import { SMART_STREAMER_PID } from "./smartStreamerPid";

/**
 * Fail-closed: returns false while loading and on any error, so the nav
 * entry never flashes visible-then-hidden and never shows for a home that
 * doesn't actually own a Smart Streamer device. Replace with a read of
 * the cheap /api/v1/homes/:homeId/pid-families check once it exists —
 * today this pays for a full device-list fetch just to answer one
 * boolean, which is exactly the cost that endpoint is meant to avoid.
 */
export function useHasSmartStreamerDevice(): boolean {
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
          setHasDevice(devices.some((device) => device.pid === SMART_STREAMER_PID));
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
