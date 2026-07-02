import type { CreatePidInput } from "@jenix/device-schemas";

import type { HardwareFieldUpdater } from "./pidForm.types";

export interface PidHardwareFormProps {
  hardware: CreatePidInput["hardware"];
  updateHardware: HardwareFieldUpdater;
}

export function PidHardwareForm({
  hardware,
  updateHardware
}: PidHardwareFormProps) {
  return (
    <section className="form-card">
      <h2>Hardware</h2>
      <div className="form-grid">
        <label className="field">
          <span>MCU</span>
          <input
            value={hardware.mcu}
            onChange={(event) => updateHardware("mcu", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Hardware Revision</span>
          <input
            value={hardware.hardwareRevision}
            onChange={(event) =>
              updateHardware("hardwareRevision", event.target.value)
            }
          />
        </label>
      </div>
      <div className="toggle-grid">
        <label>
          <input
            type="checkbox"
            checked={hardware.hasBle}
            onChange={(event) => updateHardware("hasBle", event.target.checked)}
          />
          BLE
        </label>
        <label>
          <input
            type="checkbox"
            checked={hardware.hasWifi}
            onChange={(event) => updateHardware("hasWifi", event.target.checked)}
          />
          Wi-Fi
        </label>
        <label>
          <input
            type="checkbox"
            checked={hardware.hasMatter}
            onChange={(event) =>
              updateHardware("hasMatter", event.target.checked)
            }
          />
          Matter
        </label>
        <label>
          <input
            type="checkbox"
            checked={hardware.hasThread}
            onChange={(event) =>
              updateHardware("hasThread", event.target.checked)
            }
          />
          Thread
        </label>
        <label>
          <input
            type="checkbox"
            checked={hardware.hasEthernet}
            onChange={(event) =>
              updateHardware("hasEthernet", event.target.checked)
            }
          />
          Ethernet
        </label>
      </div>
    </section>
  );
}
