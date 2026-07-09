import { FiX, FiRadio, FiThermometer, FiBattery, FiDroplet, FiDownloadCloud, FiActivity } from "react-icons/fi";

import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import { levelColor, litres, type DeviceMetrics } from "../telemetry/deviceTelemetry";
import { Sparkline } from "./Sparkline";
import { StatusChip, type DeviceStatus } from "./StatusChip";
import { TankGauge } from "./TankGauge";
import { ToggleSwitch } from "./ToggleSwitch";

export interface DeviceDrawerProps {
  device: DashboardDevice;
  metrics: DeviceMetrics;
  onClose: () => void;
  onTogglePump: () => void;
  onAction: (title: string, detail: string) => void;
}

function statusOf(device: DashboardDevice, metrics: DeviceMetrics): DeviceStatus {
  if (!device.online) return "offline";
  if (metrics.alert) return "alert";
  return "online";
}

export function DeviceDrawer({ device, metrics, onClose, onTogglePump, onAction }: DeviceDrawerProps) {
  const color = levelColor(metrics.levelPct);
  const tiles = [
    { k: "Signal", v: metrics.rssi, u: "dBm", icon: <FiRadio />, c: "var(--cyan2)" },
    { k: "Temp", v: metrics.temp || "—", u: "°C", icon: <FiThermometer />, c: "var(--amber)" },
    { k: "Battery", v: metrics.batt, u: "%", icon: <FiBattery />, c: "var(--green)" },
    { k: "Flow", v: metrics.flow.toFixed(1), u: "L/m", icon: <FiDroplet />, c: "var(--violet)" }
  ];

  return (
    <>
      <div className="jx-scrim" onClick={onClose} />
      <aside className="jx-sheet" role="dialog" aria-label={`${device.displayName} console`}>
        <div className="grab" />
        <div className="jx-sh">
          <div>
            <h3>{device.displayName}</h3>
            <div className="sub">
              <StatusChip status={statusOf(device, metrics)} /> · {device.pid}
            </div>
          </div>
          <button className="jx-close" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="jx-sb">
          <div className="jx-blk" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <TankGauge pct={metrics.levelPct} size={120} />
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color, letterSpacing: "-2px", lineHeight: 1 }}>
                {litres(metrics)}
                <small style={{ fontSize: 15, color: "var(--muted)", fontWeight: 700 }}> L</small>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 6 }}>
                of {metrics.capacityL.toLocaleString()} L · {metrics.tankMm} mm column
              </div>
            </div>
          </div>

          <div className="jx-tg">
            {tiles.map((tile) => (
              <div className="jx-t" key={tile.k}>
                <div className="tk">
                  <span style={{ color: tile.c }}>{tile.icon}</span> {tile.k}
                </div>
                <div className="tv">
                  {tile.v}
                  <small> {tile.u}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="jx-blk">
            <div className="bt">
              Live level
              <span style={{ fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 6 }}>
                <FiActivity size={12} /> streaming
              </span>
            </div>
            <Sparkline data={metrics.history} color={color} height={90} />
          </div>

          <div className="jx-blk">
            <div className="bt">Controls</div>
            <div className="jx-row">
              <div className="cl">
                Pump<small>Auto-fill from mains</small>
              </div>
              <ToggleSwitch on={metrics.pump} onToggle={onTogglePump} label="pump" />
            </div>
            <div className="jx-row">
              <div className="cl">
                Low-level alert<small>Warn below 20%</small>
              </div>
              <StatusChip status={metrics.alert ? "alert" : "online"} label={metrics.alert ? "Active" : "Armed"} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="jx-btn ghost"
              style={{ flex: 1 }}
              onClick={() => onAction("Firmware", `${device.displayName} is on the latest release`)}
            >
              <FiDownloadCloud size={16} /> Firmware
            </button>
            <button
              className="jx-btn ghost"
              style={{ flex: 1 }}
              onClick={() => onAction("Diagnostics sent", "Ping · RSSI · uptime report queued")}
            >
              <FiActivity size={16} /> Diagnostics
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
