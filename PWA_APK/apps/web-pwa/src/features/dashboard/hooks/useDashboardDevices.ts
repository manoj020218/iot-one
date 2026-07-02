import type { AuthSession } from "@jenix/shared";
import { useEffect, useState } from "react";

import {
  getDashboardDevices,
  renameDashboardDevice,
  type DashboardDevice
} from "../services/dashboardApi";

export function useDashboardDevices(session: AuthSession) {
  const [devices, setDevices] = useState<DashboardDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      setDevices(await getDashboardDevices(session));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dashboard devices."
      );
    } finally {
      setLoading(false);
    }
  }

  async function rename(deviceId: string, displayName: string) {
    const updated = await renameDashboardDevice(session, deviceId, displayName);
    setDevices((current) =>
      current.map((device) => (device.deviceId === deviceId ? updated : device))
    );
  }

  useEffect(() => {
    void load();
  }, [session.user.userId, session.activeHomeId]);

  return {
    devices,
    loading,
    error,
    rename
  };
}
