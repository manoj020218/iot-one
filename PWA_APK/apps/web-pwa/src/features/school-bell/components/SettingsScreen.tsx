import type { HomeAccessRole } from "@jenix/shared";
import { useState } from "react";
import { FiArrowLeft, FiWifi } from "react-icons/fi";

import { canManageDangerZone, canManageSchedule } from "../services/schoolBellRoles";
import type { DeviceClock } from "../services/useDeviceClock";
import type { DeviceConfigState } from "../services/useDeviceConfig";
import { useCloudConfig } from "../services/useCloudConfig";
import type { SchoolBellConnection } from "../services/useSchoolBellConnection";
import { CloudBridgeSection } from "./CloudBridgeSection";
import { DeviceInfoSection } from "./DeviceInfoSection";
import { FormatSdSheet } from "./FormatSdSheet";
import { LocalAddressSheet } from "./LocalAddressSheet";
import { SetTimeSheet } from "./SetTimeSheet";

export interface SettingsScreenProps {
  role: HomeAccessRole;
  connection: SchoolBellConnection;
  clock: DeviceClock;
  config: DeviceConfigState;
  onBack: () => void;
}

export function SettingsScreen({ role, connection, clock, config, onBack }: SettingsScreenProps) {
  const [addressOpen, setAddressOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const canEdit = canManageSchedule(role) && connection.mode === "local";
  const canDanger = canManageDangerZone(role) && connection.mode === "local";
  const cloudBridge = useCloudConfig(connection.baseUrl);

  return (
    <div className="sb-page">
      <div className="sb-back">
        <button className="sb-iconbtn" onClick={onBack} type="button">
          <FiArrowLeft size={15} />
        </button>
        <h2>Device settings</h2>
      </div>

      <div className="sb-sec">
        <h3>School profile</h3>
      </div>
      <div className="sb-card" style={{ padding: 14 }}>
        <div className="sb-field">
          <label>School name</label>
          <input
            disabled={!canEdit}
            onBlur={(event) => config.save({ school_name: event.target.value })}
            defaultValue={config.config?.school_name ?? ""}
            type="text"
          />
        </div>
        <div className="sb-field" style={{ marginBottom: 0 }}>
          <label>Bell volume — {config.config?.volume_percent ?? 0}%</label>
          <input
            defaultValue={config.config?.volume_percent ?? 70}
            disabled={!canEdit}
            max={100}
            min={0}
            onMouseUp={(event) => config.save({ volume_percent: Number(event.currentTarget.value) })}
            type="range"
          />
        </div>
      </div>

      <div className="sb-sec">
        <h3>Network</h3>
      </div>
      <div className="sb-card">
        <div className="sb-row">
          <div className="swatch">
            <FiWifi size={16} />
          </div>
          <div className="body">
            <div className="t">{config.config?.wifi.ssid || "Not connected"}</div>
            <div className="s">School Wi-Fi · set during provisioning</div>
          </div>
        </div>
        <div className="sb-row">
          <div className="body">
            <div className="t">Local network address</div>
            <div className="s">{connection.localAddress ?? "Not set"}</div>
          </div>
          {role === "owner" || role === "admin" ? (
            <div className="r">
              <button className="sb-btn ghost" onClick={() => setAddressOpen(true)} type="button">
                Edit
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="sb-sec">
        <h3>Connection mode</h3>
      </div>
      <div className="sb-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cloud &amp; remote features</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
              Off by default — schedule, ringing and holidays always work over local Wi-Fi with no internet.
            </div>
          </div>
          <button
            className={`sb-switch ${connection.cloudEnabled ? "on" : ""}`}
            disabled={role === "viewer" || role === "member"}
            onClick={() => connection.setCloudEnabled(!connection.cloudEnabled)}
            type="button"
          />
        </div>
        <div className="sb-info">
          Turning this on will let you manage this bell and see status from outside the school over the internet, once the paid plan
          adds it. Everything else works the same either way.
        </div>
      </div>

      <CloudBridgeSection baseUrl={connection.baseUrl} canEdit={canEdit} cloud={cloudBridge} />

      <DeviceInfoSection clock={clock} connection={connection} onSetTime={() => setTimeOpen(true)} role={role} />

      {canDanger ? (
        <>
          <div className="sb-sec">
            <h3>Danger zone</h3>
          </div>
          <div className="sb-danger">
            <h4>Format SD card</h4>
            <p>Erases every sound, schedule and log on this device. Cannot be undone.</p>
            <button className="sb-btn danger" onClick={() => setFormatOpen(true)} type="button">
              Format SD card
            </button>
          </div>
        </>
      ) : null}

      <LocalAddressSheet
        initialValue={connection.localAddress}
        onClose={() => setAddressOpen(false)}
        onSave={(address) => {
          connection.saveLocalAddress(address);
          setAddressOpen(false);
        }}
        open={addressOpen}
      />
      <SetTimeSheet baseUrl={connection.baseUrl} onClose={() => setTimeOpen(false)} onSynced={clock.syncNow} open={timeOpen} />
      <FormatSdSheet baseUrl={connection.baseUrl} onClose={() => setFormatOpen(false)} open={formatOpen} />
    </div>
  );
}
