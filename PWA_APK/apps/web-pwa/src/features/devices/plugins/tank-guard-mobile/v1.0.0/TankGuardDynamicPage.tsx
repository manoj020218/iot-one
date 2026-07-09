import { useEffect, useState } from "react";

import type { DevicePackageRenderProps } from "../../devicePackage.types";
import { TankGuardSettingsPanel } from "./TankGuardSettingsPanel";
import {
  defaultTankGuardSettings,
  readTankGuardSettings,
  readTankGuardSnapshot,
  type TankGuardSettingsDraft
} from "./tankGuardRuntime";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function TankGuardDynamicPage({
  device,
  runtime,
  busy,
  onRefresh,
  onCommand
}: DevicePackageRenderProps) {
  const settings = readTankGuardSettings(runtime);
  const snapshot = readTankGuardSnapshot(runtime, settings);
  const [draft, setDraft] = useState<TankGuardSettingsDraft>(defaultTankGuardSettings);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [runtime]);

  return (
    <section className="content-grid">
      <article className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Tank Guard Package</span>
            <h2 style={{ marginBottom: 4 }}>{device.displayName}</h2>
            <p className="hint-text">
              Live package resolved from the HOME UI bootstrap contract.
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid rgba(15, 23, 42, 0.12)",
              borderRadius: 24,
              padding: 20,
              background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)"
            }}
          >
            <div
              style={{
                height: 280,
                borderRadius: 28,
                overflow: "hidden",
                position: "relative",
                background: "linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%)"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "auto 0 0 0",
                  height: `${clampPercent(snapshot.levelPct)}%`,
                  background: "linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)",
                  transition: "height 300ms ease"
                }}
              />
              <div style={{ position: "absolute", inset: 20, display: "grid", alignContent: "space-between" }}>
                <div>
                  <p className="device-pid-label">Water Level</p>
                  <h3 style={{ fontSize: 40, margin: 0 }}>{snapshot.levelPct.toFixed(0)}%</h3>
                </div>
                <div className="summary-grid">
                  <div>
                    <dt>Level (mm)</dt>
                    <dd>{snapshot.waterLevelMm}</dd>
                  </div>
                  <div>
                    <dt>Zero (mm)</dt>
                    <dd>{snapshot.zeroLevelMm}</dd>
                  </div>
                  <div>
                    <dt>Pump</dt>
                    <dd>{snapshot.pumpRunning ? "Running" : "Idle"}</dd>
                  </div>
                  <div>
                    <dt>Sensor</dt>
                    <dd>{snapshot.sensorStatus}</dd>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <dl className="summary-grid">
            <div><dt>WiFi RSSI</dt><dd>{snapshot.rssiDbm} dBm</dd></div>
            <div><dt>Flow</dt><dd>{snapshot.flowLitresPerMin} L/min</dd></div>
            <div><dt>SSID</dt><dd>{snapshot.wifiSsid || "Unavailable"}</dd></div>
            <div><dt>Local IP</dt><dd>{snapshot.localIp || "Unavailable"}</dd></div>
            <div><dt>Local URL</dt><dd>{snapshot.localUrl || "Unavailable"}</dd></div>
            <div><dt>WiFi TX</dt><dd>{snapshot.wifiTxPowerDbm} dBm</dd></div>
            <div><dt>Alarm</dt><dd>{snapshot.alarmState}</dd></div>
            <div><dt>Updated</dt><dd>{snapshot.occurredAt}</dd></div>
          </dl>
          <section className="panel">
            <div className="scene-section-head">
              <div>
                <span className="eyebrow">Calibration</span>
                <h2 style={{ marginBottom: 4 }}>Zero and Capacity Controls</h2>
                <p className="hint-text">
                  Capacity is {draft.config.capacityLitres} L and TX power defaults to 8.5 dBm.
                </p>
              </div>
            </div>
            <div className="card-actions">
              <button className="text-button" disabled={busy} type="button" onClick={() => void onRefresh()}>
                Refresh Runtime
              </button>
              <button
                className="text-button"
                disabled={busy}
                type="button"
                onClick={() => void onCommand({ command: "zero_calibrate", requiresAck: true })}
              >
                Zero Calibrate
              </button>
              <button className="text-button" disabled={busy} type="button" onClick={() => setShowSettings((current) => !current)}>
                {showSettings ? "Hide Settings" : "Detail Settings"}
              </button>
            </div>
          </section>
        </div>
      </article>
      {showSettings ? (
        <TankGuardSettingsPanel
          saving={busy}
          value={draft}
          onChange={setDraft}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            void onCommand({
              command: "apply_settings",
              requiresAck: true,
              payload: {
                schemaVersion: 1,
                settings: draft
              }
            });
            setShowSettings(false);
          }}
        />
      ) : null}
    </section>
  );
}
