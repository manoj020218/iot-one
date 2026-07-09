import { FiActivity, FiRadio, FiBox } from "react-icons/fi";

import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import {
  levelColor,
  litres,
  rssiBars,
  type DeviceMetrics
} from "../telemetry/deviceTelemetry";
import { Sparkline } from "./Sparkline";
import { SignalBars } from "./SignalBars";
import { StatusChip, type DeviceStatus } from "./StatusChip";
import { TankGauge } from "./TankGauge";
import { ToggleSwitch } from "./ToggleSwitch";

export interface DeviceTileProps {
  device: DashboardDevice;
  metrics: DeviceMetrics;
  onOpen: () => void;
  onTogglePump: () => void;
}

function statusOf(device: DashboardDevice, metrics: DeviceMetrics): DeviceStatus {
  if (!device.online) return "offline";
  if (metrics.alert) return "alert";
  return "online";
}

export function DeviceTile({ device, metrics, onOpen, onTogglePump }: DeviceTileProps) {
  const color = levelColor(metrics.levelPct);

  return (
    <article className="jx-tile" onClick={onOpen}>
      <div className="th">
        <div>
          <div className="nm">{device.displayName}</div>
          <div className="ty">
            <FiBox size={13} /> {device.pidLabel}
          </div>
        </div>
        <StatusChip status={statusOf(device, metrics)} />
      </div>

      <div className="jx-tbody">
        <div style={{ position: "relative" }}>
          <TankGauge pct={metrics.levelPct} size={92} />
          <div
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "var(--muted)",
              marginTop: 2
            }}
          >
            {litres(metrics)} L
          </div>
        </div>

        <div className="jx-metrics">
          <div className="jx-metric">
            <span className="l">
              <FiActivity size={13} /> Level
            </span>
            <span className="r" style={{ color }}>
              {metrics.tankMm} mm
            </span>
          </div>
          <div className="jx-metric">
            <span className="l">
              <FiRadio size={13} /> Signal
            </span>
            <span className="r">
              <SignalBars level={rssiBars(metrics.rssi)} />{" "}
              <span style={{ color: "var(--muted)", fontWeight: 500 }}>{metrics.rssi}</span>
            </span>
          </div>
          <div className="jx-metric">
            <span className="l">Flow</span>
            <span className="r">{metrics.flow.toFixed(1)} L/m</span>
          </div>
        </div>
      </div>

      <Sparkline data={metrics.history} color={color} />

      <div className="jx-foot">
        <span className="upd">{device.online ? "updated just now" : "offline"}</span>
        <ToggleSwitch on={metrics.pump} onToggle={onTogglePump} label="pump" />
      </div>
    </article>
  );
}
