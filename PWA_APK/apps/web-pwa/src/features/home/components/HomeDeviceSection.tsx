import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import type { MetricsMap } from "../hooks/useLiveMetrics";
import { DeviceTile } from "./DeviceTile";
import { HomeFilterTabs, type HomeFilter } from "./HomeFilterTabs";

export interface HomeDeviceSectionProps {
  devices: DashboardDevice[];
  filter: HomeFilter;
  metrics: MetricsMap;
  onChangeFilter: (filter: HomeFilter) => void;
  onOpenDevice: (deviceId: string) => void;
  onTogglePump: (deviceId: string) => void;
}

export function HomeDeviceSection({
  devices,
  filter,
  metrics,
  onChangeFilter,
  onOpenDevice,
  onTogglePump
}: HomeDeviceSectionProps) {
  const visible = devices.filter((device) => {
    if (filter === "online") {
      return device.online;
    }

    if (filter === "alert") {
      return Boolean(metrics[device.deviceId]?.alert);
    }

    return true;
  });

  return (
    <section>
      <div className="jx-sec">
        <h2>Devices in this home</h2>
        <HomeFilterTabs active={filter} onChange={onChangeFilter} />
      </div>
      {visible.length === 0 ? (
        <section className="empty-state">
          <h2>No devices for this filter</h2>
          <p>Provision a device or switch to another home to continue.</p>
        </section>
      ) : (
        <div className="jx-grid">
          {visible.map((device) => {
            const deviceMetrics = metrics[device.deviceId];
            if (!deviceMetrics) {
              return null;
            }

            return (
              <DeviceTile
                device={device}
                key={device.deviceId}
                metrics={deviceMetrics}
                onOpen={() => onOpenDevice(device.deviceId)}
                onTogglePump={() => onTogglePump(device.deviceId)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
