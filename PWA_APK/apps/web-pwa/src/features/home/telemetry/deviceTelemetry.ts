import type { DashboardDevice } from "../../dashboard/services/dashboardApi";

/**
 * Live-ish telemetry surface used by the modern dashboard tiles/gauges.
 *
 * NOTE: When the backend telemetry API is wired to the dashboard, replace
 * `deriveBaseMetrics` with a mapping from the real device telemetry payload
 * (see packages/device-schemas → TelemetryFieldDefinition: `tankLevelMm`,
 * `signalStrength`). The shape below is deliberately telemetry-agnostic so a
 * new device type only needs to fill these fields (see DEVICE_INTEGRATION_GUIDE).
 */
export interface DeviceMetrics {
  levelPct: number;
  capacityL: number;
  tankMm: number;
  rssi: number;
  flow: number;
  temp: number;
  batt: number;
  pump: boolean;
  alert: boolean;
  history: number[];
}

const CAPACITY_TABLE = [500, 800, 1000, 1500, 2000, 5000];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Deterministic per-device base metrics so tiles look stable across renders. */
export function deriveBaseMetrics(device: DashboardDevice): DeviceMetrics {
  const seed = hashString(device.deviceId);
  const levelPct = device.online ? 12 + (seed % 84) : 30 + (seed % 40);
  const capacityL = CAPACITY_TABLE[seed % CAPACITY_TABLE.length] ?? 1000;
  const fullMm = capacityL >= 3000 ? 2000 : capacityL;
  const pump = device.online && seed % 3 === 0;

  return {
    levelPct,
    capacityL,
    tankMm: Math.round((levelPct / 100) * fullMm),
    rssi: device.online ? -45 - (seed % 45) : -95,
    flow: pump ? Number((3 + (seed % 8)).toFixed(1)) : 0,
    temp: device.online ? Number((26 + (seed % 18)).toFixed(1)) : 0,
    batt: 40 + (seed % 60),
    pump,
    alert: device.online && levelPct <= 20,
    history: Array.from({ length: 40 }, (_, index) =>
      Number((levelPct + Math.sin((seed + index) / 4) * 4).toFixed(1))
    )
  };
}

/** Advance one simulated tick — remove once real telemetry streams in. */
export function advanceMetrics(metrics: DeviceMetrics): DeviceMetrics {
  const drift = (metrics.pump ? 0.6 : -0.15) + (Math.random() * 0.6 - 0.3);
  const levelPct = Math.max(3, Math.min(98, Number((metrics.levelPct + drift).toFixed(1))));
  const fullMm = metrics.capacityL >= 3000 ? 2000 : metrics.capacityL;
  const history = [...metrics.history.slice(1), levelPct];

  return {
    ...metrics,
    levelPct,
    tankMm: Math.round((levelPct / 100) * fullMm),
    rssi: Math.max(-95, Math.min(-45, metrics.rssi + Math.round(Math.random() * 4 - 2))),
    temp: metrics.temp ? Number((metrics.temp + (Math.random() * 0.4 - 0.2)).toFixed(1)) : 0,
    alert: levelPct <= 20,
    history
  };
}

export function levelColor(pct: number): string {
  if (pct <= 20) return "var(--red)";
  if (pct <= 40) return "var(--amber)";
  return "var(--cyan2)";
}

export function litres(metrics: DeviceMetrics): number {
  return Math.round((metrics.capacityL * metrics.levelPct) / 100);
}

export function rssiBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -80) return 2;
  if (rssi >= -100) return 1;
  return 0;
}
