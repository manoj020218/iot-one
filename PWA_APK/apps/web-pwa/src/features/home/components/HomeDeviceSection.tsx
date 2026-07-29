import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import type { MetricsMap } from "../hooks/useLiveMetrics";
import { DeviceTile } from "./DeviceTile";
import { HomeFilterTabs, type HomeFilter } from "./HomeFilterTabs";

export interface HomeDeviceSectionProps {
  devices: DashboardDevice[];
  filter: HomeFilter;
  homeName: string;
  metrics: MetricsMap;
  onChangeFilter: (filter: HomeFilter) => void;
  onOpenDevice: (deviceId: string) => void;
  onTogglePump: (deviceId: string) => void;
}

export function HomeDeviceSection({
  devices,
  filter,
  homeName,
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

  if (devices.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="jx-sec">
        <h2>Devices in {homeName}</h2>
        <HomeFilterTabs active={filter} onChange={onChangeFilter} />
      </div>
      {visible.length === 0 ? (
        <p className="hint-text">No devices match this filter.</p>
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
