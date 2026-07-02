import type { CreatePidInput } from "@jenix/device-schemas";

import type { FirmwareFieldUpdater } from "./pidForm.types";

export interface PidFirmwareFormProps {
  firmware: CreatePidInput["firmware"];
  updateFirmware: FirmwareFieldUpdater;
}

export function PidFirmwareForm({
  firmware,
  updateFirmware
}: PidFirmwareFormProps) {
  return (
    <section className="form-card">
      <h2>Firmware</h2>
      <div className="form-grid">
        <label className="field">
          <span>Firmware Family</span>
          <input
            value={firmware.firmwareFamily}
            onChange={(event) =>
              updateFirmware("firmwareFamily", event.target.value)
            }
          />
        </label>
        <label className="field">
          <span>OTA Channel</span>
          <input
            value={firmware.otaChannel}
            onChange={(event) =>
              updateFirmware("otaChannel", event.target.value)
            }
          />
        </label>
        <label className="field">
          <span>Stable Version</span>
          <input
            value={firmware.stableVersion ?? ""}
            onChange={(event) =>
              updateFirmware("stableVersion", event.target.value || undefined)
            }
          />
        </label>
        <label className="field checkbox-field">
          <span>Rollback Allowed</span>
          <input
            type="checkbox"
            checked={firmware.rollbackAllowed}
            onChange={(event) =>
              updateFirmware("rollbackAllowed", event.target.checked)
            }
          />
        </label>
      </div>
    </section>
  );
}
