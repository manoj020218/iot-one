import { useEffect, useState } from "react";

import type { CloudConfigState } from "../services/useCloudConfig";
import { CloudCredentialSheet } from "./CloudCredentialSheet";

export interface CloudBridgeSectionProps {
  baseUrl: string | null;
  cloud: CloudConfigState;
  canEdit: boolean;
}

/**
 * The device's real MQTT bridge (status/LWT + OTA) — separate concern
 * from the app-level "Cloud & remote features" toggle above it in
 * Settings, which gates this app's own (not-yet-built) relay-control
 * path. This section is what actually makes the bell show up as
 * online/offline on the platform dashboard and lets a firmware update
 * reach it. Binding is manual by design — platform provisioning for this
 * device is still deferred (see FIRMWARE_TASKS_APK_INTEGRATION.md).
 */
export function CloudBridgeSection({ baseUrl, cloud, canEdit }: CloudBridgeSectionProps) {
  const [homeId, setHomeId] = useState("");
  const [mqttHost, setMqttHost] = useState("");
  const [mqttPort, setMqttPort] = useState(1883);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cloud.config) {
      setHomeId(cloud.config.homeId);
      setMqttHost(cloud.config.mqttHost);
      setMqttPort(cloud.config.mqttPort);
    }
  }, [cloud.config]);

  async function handleSave() {
    setSaving(true);
    try {
      await cloud.save({ homeId, mqttHost, mqttPort });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sb-sec">
        <h3>MQTT bridge (device)</h3>
      </div>
      <div className="sb-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {cloud.config?.connected ? "Connected" : cloud.config?.configured ? "Configured, not connected" : "Not set up"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
              Lets the platform see this bell online and push firmware updates.
            </div>
          </div>
          <button
            className={`sb-switch ${cloud.config?.enabled ? "on" : ""}`}
            disabled={!canEdit}
            onClick={() => cloud.save({ enabled: !cloud.config?.enabled })}
            type="button"
          />
        </div>
        <div className="sb-field">
          <label>HOME ID</label>
          <input disabled={!canEdit} onChange={(event) => setHomeId(event.target.value)} type="text" value={homeId} />
        </div>
        <div className="sb-field">
          <label>MQTT host</label>
          <input disabled={!canEdit} onChange={(event) => setMqttHost(event.target.value)} type="text" value={mqttHost} />
        </div>
        <div className="sb-field" style={{ marginBottom: 0 }}>
          <label>MQTT port</label>
          <input
            disabled={!canEdit}
            onChange={(event) => setMqttPort(Number(event.target.value))}
            type="text"
            value={mqttPort}
          />
        </div>
        {canEdit ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="sb-btn primary" disabled={saving} onClick={handleSave} style={{ height: 40 }} type="button">
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="sb-btn ghost" onClick={() => setCredentialOpen(true)} style={{ height: 40 }} type="button">
              MQTT credential
            </button>
          </div>
        ) : null}
      </div>

      <CloudCredentialSheet baseUrl={baseUrl} onClose={() => setCredentialOpen(false)} onSaved={cloud.reload} open={credentialOpen} />
    </>
  );
}
