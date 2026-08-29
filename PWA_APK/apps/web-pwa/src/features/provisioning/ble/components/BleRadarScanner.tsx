import { useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { Sheet } from "../../../../app/components/Sheet";

export interface BleRadarScannerProps {
  bluetoothEnabled: boolean;
  permissionDenied: boolean;
  scanning: boolean;
}

/**
 * The four states below are the device's real StatusLedService.cpp blink
 * patterns (IOT_Device/QRunlock/src/status_led/StatusLedService.cpp),
 * translated into what a user actually sees and needs to do -- not
 * fabricated content. This exact troubleshooting card didn't exist
 * anywhere before this (see VPS/HANDOFF.md's provisioning round), so it's
 * built from the firmware's own pattern timings, not copied from an
 * existing doc.
 */
const LED_STATES = [
  {
    key: "fast",
    title: "Fast blink",
    detail: "Ready to pair — this is what Smart Mode is looking for right now."
  },
  {
    key: "slow",
    title: "Slow blink",
    detail: "Waiting for Wi-Fi setup — the device's own hotspot is active for AP Mode."
  },
  {
    key: "solid",
    title: "Solid, steady on",
    detail: "Already connected and online — no setup needed."
  },
  {
    key: "error",
    title: "Rapid triple-flash",
    detail: "Something's wrong on the device itself. Power-cycle it; contact support if this continues."
  }
] as const;

export function BleRadarScanner({
  bluetoothEnabled,
  permissionDenied,
  scanning
}: BleRadarScannerProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [ledHelpOpen, setLedHelpOpen] = useState(false);

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
      <div className="prov-links">
        <p>
          Still stuck?{" "}
          <button onClick={() => setLedHelpOpen(true)} type="button">
            Check the status light
          </button>
        </p>
      </div>
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
      <Sheet
        onClose={() => setLedHelpOpen(false)}
        open={ledHelpOpen}
        subtitle="Both Smart Mode and AP Mode look for the same status light on the device."
        title="What the status light means"
      >
        <div className="prov-led-list">
          {LED_STATES.map((state) => (
            <div className="prov-led-row" key={state.key}>
              <span className="prov-led-swatch" aria-hidden="true">
                <span className={`prov-led-dot ${state.key}`} />
              </span>
              <div className="prov-led-text">
                <div className="prov-led-title">{state.title}</div>
                <div className="prov-led-sub">{state.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
