import type { AuthSession } from "@jenix/shared";
import type { ComponentType, ReactNode } from "react";

import type { DashboardDevice } from "../../dashboard/services/dashboardApi";
import { QRUNLOCK_PID } from "../../qrunlock/qrunlockPid";
import { TOKEN_DISPENSER_PID } from "../../token-dispenser/tokenDispenserPid";
import { useLongPressGuard } from "../hooks/useLongPressGuard";
import type { MetricsMap } from "../hooks/useLiveMetrics";
import { DeviceTile } from "./DeviceTile";
import { HomeFilterTabs, type HomeFilter } from "./HomeFilterTabs";
import { QrunlockHomeTile } from "./QrunlockHomeTile";
import { TokenDispenserHomeTile } from "./TokenDispenserHomeTile";

/**
 * Wraps one tile with the shared offline gray-shade + Tuya-style long-press
 * gesture -- a real component (not an inline .map() callback) because
 * useLongPressGuard is a hook and hook rules forbid calling one inside a
 * loop/callback whose iteration count can change between renders (filtering
 * the device list does exactly that).
 */
function HomeTileSlot({
  device,
  onRequestRemove,
  children
}: {
  device: DashboardDevice;
  onRequestRemove: (device: DashboardDevice) => void;
  children: ReactNode;
}) {
  const longPress = useLongPressGuard(() => onRequestRemove(device));

  return (
    <div className={device.online ? undefined : "is-offline"} {...longPress}>
      {children}
    </div>
  );
}

interface CompactTileProps {
  session: AuthSession;
  device: DashboardDevice;
  onOpen: () => void;
  onToast: (message: string) => void;
}

/**
 * The standard home-grid tile for every new device, per
 * DEVICE_PACKAGE_RUNTIME.md's "every device UI is a dynamic remote
 * package" rule's sibling convention: same compact "Icon Card" footprint
 * (qr-home-* classes in theme/home.css) for every device, not DeviceTile's
 * tank/flow/pump shape, which only ever fit Tank Guard and was previously
 * reused, unmodified, for every PID -- fabricating tank-style metrics on
 * devices (a door lock, a token dispenser) that have none of them. See
 * VPS/HANDOFF.md for the approved mockup this was built from.
 *
 * To add a new device here: build a `<Product>HomeTile.tsx` reusing the
 * same qr-home-* classes (copy TokenDispenserHomeTile.tsx as the template),
 * then add one line below.
 */
const COMPACT_TILE_COMPONENTS: Record<string, ComponentType<CompactTileProps>> = {
  [QRUNLOCK_PID]: QrunlockHomeTile,
  [TOKEN_DISPENSER_PID]: TokenDispenserHomeTile
};

export interface HomeDeviceSectionProps {
  session: AuthSession;
  devices: DashboardDevice[];
  filter: HomeFilter;
  homeName: string;
  metrics: MetricsMap;
  onChangeFilter: (filter: HomeFilter) => void;
  onOpenDevice: (deviceId: string) => void;
  onRequestRemove: (device: DashboardDevice) => void;
  onTogglePump: (deviceId: string) => void;
  onToast: (message: string) => void;
}

export function HomeDeviceSection({
  session,
  devices,
  filter,
  homeName,
  metrics,
  onChangeFilter,
  onOpenDevice,
  onRequestRemove,
  onTogglePump,
  onToast
}: HomeDeviceSectionProps) {
  // Offline devices can't hear anything sent to them -- opening the
  // device-specific UI would just let someone press buttons that silently
  // do nothing, which reads as the app being broken rather than the device
  // being unreachable. Gate it here, once, instead of in every product's
  // own detail page.
  function tryOpen(device: DashboardDevice) {
    if (!device.online) {
      onToast(`${device.displayName} is offline — nothing will happen right now.`);
      return;
    }
    onOpenDevice(device.deviceId);
  }
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

  const compactDevices = visible.filter((device) => COMPACT_TILE_COMPONENTS[device.pid]);
  const richDevices = visible.filter((device) => !COMPACT_TILE_COMPONENTS[device.pid]);

  return (
    <section>
      <div className="jx-sec">
        <h2>Devices in {homeName}</h2>
        <HomeFilterTabs active={filter} onChange={onChangeFilter} />
      </div>
      {visible.length === 0 ? (
        <p className="hint-text">No devices match this filter.</p>
      ) : (
        <>
          {compactDevices.length > 0 ? (
            <div className="jx-compact-grid" style={{ marginBottom: richDevices.length > 0 ? 14 : 0 }}>
              {compactDevices.map((device) => {
                const Tile = COMPACT_TILE_COMPONENTS[device.pid]!;
                return (
                  <HomeTileSlot device={device} key={device.deviceId} onRequestRemove={onRequestRemove}>
                    <Tile
                      device={device}
                      onOpen={() => tryOpen(device)}
                      onToast={onToast}
                      session={session}
                    />
                  </HomeTileSlot>
                );
              })}
            </div>
          ) : null}
          {richDevices.length > 0 ? (
            <div className="jx-grid">
              {richDevices.map((device) => {
                const deviceMetrics = metrics[device.deviceId];
                if (!deviceMetrics) {
                  return null;
                }

                return (
                  <HomeTileSlot device={device} key={device.deviceId} onRequestRemove={onRequestRemove}>
                    <DeviceTile
                      device={device}
                      metrics={deviceMetrics}
                      onOpen={() => tryOpen(device)}
                      onTogglePump={() => onTogglePump(device.deviceId)}
                    />
                  </HomeTileSlot>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
