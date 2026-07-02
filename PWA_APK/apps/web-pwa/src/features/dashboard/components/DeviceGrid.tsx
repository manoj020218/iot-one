import type { DashboardDevice } from "../services/dashboardApi";
import { DeviceCard } from "./DeviceCard";
import { EmptyHomeState } from "./EmptyHomeState";

export interface DeviceGridProps {
  devices: DashboardDevice[];
  onRename: (deviceId: string, displayName: string) => Promise<void>;
}

export function DeviceGrid({ devices, onRename }: DeviceGridProps) {
  if (!devices.length) {
    return <EmptyHomeState />;
  }

  return (
    <section className="device-grid">
      {devices.map((device) => (
        <DeviceCard
          key={device.deviceId}
          device={device}
          onRename={onRename}
        />
      ))}
    </section>
  );
}
