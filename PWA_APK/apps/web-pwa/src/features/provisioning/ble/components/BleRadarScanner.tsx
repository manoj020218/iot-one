import { useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { Sheet } from "../../../../app/components/Sheet";

export interface BleRadarScannerProps {
  bluetoothEnabled: boolean;
  permissionDenied: boolean;
  scanning: boolean;
}

export function BleRadarScanner({
  bluetoothEnabled,
  permissionDenied,
  scanning
}: BleRadarScannerProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <section className="ble-radar">
      {!bluetoothEnabled ? (
        <p className="ble-radar-alert">
          <FiAlertTriangle size={16} />
          Turn on Bluetooth to search for nearby devices.
        </p>
      ) : null}
      {permissionDenied ? (
        <p className="ble-radar-alert">
          <FiAlertTriangle size={16} />
          Location and Bluetooth permission is needed to find nearby devices.
        </p>
      ) : null}
      <div className="ble-radar-stage" data-scanning={scanning}>
        <span className="ble-radar-ring" />
        <span className="ble-radar-ring" />
        <span className="ble-radar-ring" />
        <span className="ble-radar-core" />
      </div>
      <h2 className="ble-radar-title">Searching nearby devices</h2>
      <p className="ble-radar-hint">
        Make sure the device is powered on and in{" "}
        <button
          className="ble-radar-link"
          onClick={() => setGuideOpen(true)}
          type="button"
        >
          Pairing Mode
        </button>
        .
      </p>
      <Sheet
        onClose={() => setGuideOpen(false)}
        open={guideOpen}
        subtitle="Every Jenix device uses the same basic steps to enter pairing mode."
        title="How to enter Pairing Mode"
      >
        <ol className="ble-radar-guide-steps">
          <li>Make sure the device is powered on and within a few feet of your phone.</li>
          <li>Press and hold the device's pairing button for 3-5 seconds.</li>
          <li>Wait for the status light to blink, which means it's ready to be found.</li>
          <li>Come back here and keep this screen open until it appears in the list.</li>
        </ol>
      </Sheet>
    </section>
  );
}
