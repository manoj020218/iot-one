import { useEffect, useRef, useState } from "react";

import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import {
  advanceMetrics,
  deriveBaseMetrics,
  type DeviceMetrics
} from "../telemetry/deviceTelemetry";

export type MetricsMap = Record<string, DeviceMetrics>;

/**
 * Keeps a per-device metrics map and advances it every `intervalMs` so tiles
 * feel live. Swap `advanceMetrics` for a telemetry WebSocket subscription when
 * the backend streams real values (see deviceTelemetry.ts).
 */
export function useLiveMetrics(devices: DashboardDevice[], intervalMs = 2000) {
  const [metrics, setMetrics] = useState<MetricsMap>({});
  const metricsRef = useRef<MetricsMap>({});

  // Seed / reconcile whenever the device list changes.
  useEffect(() => {
    setMetrics((previous) => {
      const next: MetricsMap = {};
      for (const device of devices) {
        next[device.deviceId] = previous[device.deviceId] ?? deriveBaseMetrics(device);
      }
      metricsRef.current = next;
      return next;
    });
  }, [devices]);

  // Live tick.
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics((previous) => {
        const next: MetricsMap = {};
        for (const [id, value] of Object.entries(previous)) {
          const device = devices.find((candidate) => candidate.deviceId === id);
          next[id] = device?.online ? advanceMetrics(value) : value;
        }
        metricsRef.current = next;
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [devices, intervalMs]);

  function togglePump(deviceId: string): void {
    setMetrics((previous) => {
      const current = previous[deviceId];
      if (!current) return previous;
      const pump = !current.pump;
      return {
        ...previous,
        [deviceId]: {
          ...current,
          pump,
          flow: pump ? Number((Math.random() * 8 + 4).toFixed(1)) : 0
        }
      };
    });
  }

  return { metrics, togglePump };
}
