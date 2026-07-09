import type { TankGuardSettingsDraft } from "./tankGuardRuntime";

interface TankGuardSettingsPanelProps {
  value: TankGuardSettingsDraft;
  saving?: boolean | undefined;
  onChange: (next: TankGuardSettingsDraft) => void;
  onClose: () => void;
  onSave: () => void;
}

const configFields = [
  ["capacityLitres", "Capacity (L)"],
  ["wifiTxPowerDbm", "WiFi TX (dBm)"],
  ["zeroLevelMm", "Zero Level (mm)"],
  ["bottomMotorStartLevelMm", "Motor Start (mm)"],
  ["topMotorOffLevelMm", "Motor Off (mm)"],
  ["overflowMarginMm", "Overflow Margin (mm)"]
] as const;
const alarmNumberFields = [
  ["repeatMinutes", "Repeat Minutes"],
  ["lowLevelPct", "Low Level %"]
] as const;
const actionFields = [
  ["powerRestoreWaitMinutes", "Restore Wait (min)"],
  ["motorStartConfirmMinutes", "Start Confirm (min)"],
  ["motorOffConfirmMinutes", "Off Confirm (min)"],
  ["rfOnPulseMs", "RF ON Pulse (ms)"],
  ["rfOffPulseMs", "RF OFF Pulse (ms)"],
  ["rfAlarmPulseMs", "RF Alarm Pulse (ms)"]
] as const;

export function TankGuardSettingsPanel({
  value,
  saving,
  onChange,
  onClose,
  onSave
}: TankGuardSettingsPanelProps) {
  return (
    <section className="panel">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Detail Settings</span>
          <h2 style={{ marginBottom: 4 }}>Config, Alarm and Actions</h2>
          <p className="hint-text">Changes are queued to the device command channel.</p>
        </div>
      </div>
      <div className="summary-grid">
        {configFields.map(([field, label]) => (
          <label key={field}>
            <dt>{label}</dt>
            <input
              type="number"
              value={value.config[field]}
              onChange={(event) =>
                onChange({
                  ...value,
                  config: { ...value.config, [field]: Number(event.target.value) }
                })
              }
            />
          </label>
        ))}
        {alarmNumberFields.map(([field, label]) => (
          <label key={field}>
            <dt>{label}</dt>
            <input
              type="number"
              value={value.alarm[field]}
              onChange={(event) =>
                onChange({
                  ...value,
                  alarm: { ...value.alarm, [field]: Number(event.target.value) }
                })
              }
            />
          </label>
        ))}
        <label>
          <dt>Repeat Alarm</dt>
          <input
            type="checkbox"
            checked={value.alarm.repeatEnabled}
            onChange={(event) =>
              onChange({
                ...value,
                alarm: { ...value.alarm, repeatEnabled: event.target.checked }
              })
            }
          />
        </label>
        <label>
          <dt>Notify Sensor Fault</dt>
          <input
            type="checkbox"
            checked={value.alarm.notifyOnSensorFault}
            onChange={(event) =>
              onChange({
                ...value,
                alarm: { ...value.alarm, notifyOnSensorFault: event.target.checked }
              })
            }
          />
        </label>
        {actionFields.map(([field, label]) => (
          <label key={field}>
            <dt>{label}</dt>
            <input
              type="number"
              value={value.actions[field]}
              onChange={(event) =>
                onChange({
                  ...value,
                  actions: { ...value.actions, [field]: Number(event.target.value) }
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="card-actions" style={{ marginTop: 16 }}>
        <button className="text-button" type="button" onClick={onClose}>
          Close
        </button>
        <button className="text-button" disabled={saving} type="button" onClick={onSave}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
