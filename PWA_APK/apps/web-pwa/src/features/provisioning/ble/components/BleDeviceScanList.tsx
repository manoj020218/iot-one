import type { BleScanDevice } from "../../provisioning.types";
import { BleDeviceCard } from "./BleDeviceCard";

export interface BleDeviceScanListProps {
  devices: BleScanDevice[];
  selectedDeviceId?: string | undefined;
  searchQuery: string;
  scanning?: boolean;
  error?: string | null;
  onSearchChange: (value: string) => void;
  onRefresh: () => Promise<void> | void;
  onSelect: (device: BleScanDevice) => void;
}

export function BleDeviceScanList({
  devices,
  selectedDeviceId,
  searchQuery,
  scanning = false,
  error,
  onSearchChange,
  onRefresh,
  onSelect
}: BleDeviceScanListProps) {
  const normalizedQuery = searchQuery.trim().toUpperCase();
  const filteredDevices = normalizedQuery
    ? devices.filter((device) =>
        [device.deviceId, device.productName, device.pid, device.transportId]
          .join(" ")
          .toUpperCase()
          .includes(normalizedQuery)
      )
    : devices;

  return (
    <section className="form-card">
      <div className="provisioning-header-row">
        <div>
          <span className="eyebrow">Step 2</span>
          <h2>Nearby provisioning targets</h2>
          <p>
            Select the device you want to attach to the current HOME, then continue
            to Wi-Fi onboarding.
          </p>
        </div>
        <button className="text-button" onClick={() => void onRefresh()} type="button">
          Refresh scan
        </button>
      </div>
      <label className="field">
        <span>Quick search</span>
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search device ID, product, PID, or BLE transport ID"
          value={searchQuery}
        />
      </label>
      {error ? <p className="inline-error">{error}</p> : null}
      {scanning ? <p>Scanning for BLE devices...</p> : null}
      {!scanning ? (
        <p className="scan-summary">
          Showing {filteredDevices.length} of {devices.length} scanned device
          {devices.length === 1 ? "" : "s"}.
        </p>
      ) : null}
      {!scanning && devices.length === 0 ? (
        <p>No BLE devices found yet. Retry the quick scan with the device powered on.</p>
      ) : null}
      {!scanning && devices.length > 0 && filteredDevices.length === 0 ? (
        <p className="inline-error">No scanned device matched the quick search.</p>
      ) : null}
      <div className="device-grid">
        {filteredDevices.map((device) => (
          <BleDeviceCard
            device={device}
            key={device.deviceId}
            onSelect={onSelect}
            selected={device.deviceId === selectedDeviceId}
          />
        ))}
      </div>
    </section>
  );
}
