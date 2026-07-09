import { useMemo, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import type { DashboardDevice } from "../dashboard/services/dashboardApi";
import { useDashboardDevices } from "../dashboard/hooks/useDashboardDevices";
import { AddDeviceSheet, type DiscoveredDevice } from "./components/AddDeviceSheet";
import { DeviceTile } from "./components/DeviceTile";
import { HomeHeader } from "./components/HomeHeader";
import { MobileNav, type NavTab } from "./components/MobileNav";
import { StatStrip } from "./components/StatStrip";
import { useLiveMetrics } from "./hooks/useLiveMetrics";
import { useToast } from "./hooks/useToast";
import { litres } from "./telemetry/deviceTelemetry";
import "./theme/home.css";

type Filter = "all" | "online" | "alert";

export function HomeDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  if (!session) throw new Error("HomeDashboardPage requires a session");

  const { devices } = useDashboardDevices(session);
  const [added, setAdded] = useState<DashboardDevice[]>([]);
  const allDevices = useMemo(() => [...devices, ...added], [devices, added]);

  const { metrics, togglePump } = useLiveMetrics(allDevices);
  const { toast, show } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<NavTab>("home");
  const [adding, setAdding] = useState(false);

  const online = allDevices.filter((device) => device.online).length;
  const alerts = allDevices.filter((device) => metrics[device.deviceId]?.alert).length;
  const water = allDevices.reduce((sum, device) => {
    const deviceMetrics = metrics[device.deviceId];
    return sum + (deviceMetrics ? litres(deviceMetrics) : 0);
  }, 0);

  const visible = allDevices.filter((device) => {
    if (filter === "online") return device.online;
    if (filter === "alert") return metrics[device.deviceId]?.alert;
    return true;
  });

  function handleAdded(discovered: DiscoveredDevice, displayName: string): void {
    setAdded((previous) => [
      ...previous,
      {
        deviceId: `${discovered.id}-${Date.now()}`,
        displayName,
        pid: discovered.pid,
        pidLabel: discovered.pidLabel,
        pidIconText: "TG",
        online: true,
        telemetryPreview: "Just paired"
      }
    ]);
    show("Device added", `${displayName} is now live`);
  }

  return (
    <div className="jx">
      <div className="jx-aurora">
        <span />
        <span />
      </div>

      <div className="jx-shell">
        <HomeHeader
          userName={session.user.name}
          onlineCount={online}
          totalCount={allDevices.length}
          alertCount={alerts}
          onBell={() => show(`${alerts} active alerts`, "Tap a device to inspect")}
        />

        <StatStrip online={online} total={allDevices.length} waterLitres={water} alerts={alerts} />

        <div className="jx-sec">
          <h2>Devices</h2>
          <div className="jx-seg">
            {(["all", "online", "alert"] as Filter[]).map((value) => (
              <button
                key={value}
                className={filter === value ? "on" : ""}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All" : value === "online" ? "Online" : "Alerts"}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="jx-empty">
            <div className="ei">📡</div>
            No devices here yet — tap ＋ to pair one.
          </div>
        ) : (
          <div className="jx-grid">
            {visible.map((device) => {
              const deviceMetrics = metrics[device.deviceId];
              if (!deviceMetrics) return null;
              return (
                <DeviceTile
                  key={device.deviceId}
                  device={device}
                  metrics={deviceMetrics}
                  onOpen={() =>
                    navigate(`/devices/${encodeURIComponent(device.deviceId)}`)
                  }
                  onTogglePump={() => {
                    togglePump(device.deviceId);
                    show("Command sent", `${device.displayName} · pump toggled via MQTT`);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {adding ? (
        <AddDeviceSheet onClose={() => setAdding(false)} onAdded={handleAdded} />
      ) : null}

      {toast ? (
        <div className="jx-toast">
          <span className="ti">
            <FiCheckCircle size={18} />
          </span>
          <div>
            <div>{toast.title}</div>
            {toast.detail ? (
              <div style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11.5 }}>{toast.detail}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <MobileNav
        active={tab}
        onSelect={(next) => {
          setTab(next);
          if (next === "scenes") navigate("/scenes");
          else if (next === "settings") navigate("/settings");
          else if (next === "insights") show("Insights", "Coming soon");
        }}
        onAddDevice={() => setAdding(true)}
      />
    </div>
  );
}
