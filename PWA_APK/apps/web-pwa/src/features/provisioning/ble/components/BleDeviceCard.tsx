import type { BleScanDevice } from "../../provisioning.types";

export interface BleDeviceCardProps {
  device: BleScanDevice;
  selected: boolean;
  onSelect: (device: BleScanDevice) => void;
}

export function BleDeviceCard({
  device,
  selected,
  onSelect
}: BleDeviceCardProps) {
  return (
    <article className="device-card ble-device-card">
      <div className="device-card-head">
        <span className="device-icon">{device.iconText}</span>
        <div>
          <h3>{device.productName}</h3>
          <p className="device-pid-code">{device.deviceId}</p>
          <p className="device-pid-label">{device.pid}</p>
        </div>
      </div>
      <div className="ble-device-meta">
        <span>Signal {device.rssi} dBm</span>
        <span>{device.provisioningReady ? "Provisioning Ready" : "Busy"}</span>
        {device.transportId !== device.deviceId ? (
          <span>BLE {device.transportId}</span>
        ) : null}
      </div>
      <button
        className={selected ? "primary-button" : "text-button"}
        disabled={!device.provisioningReady}
        onClick={() => onSelect(device)}
        type="button"
      >
        {selected ? "Selected" : "Choose Device"}
      </button>
    </article>
  );
}
