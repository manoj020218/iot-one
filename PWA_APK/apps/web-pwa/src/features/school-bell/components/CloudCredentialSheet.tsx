import { useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import { updateDeviceMqttCredential } from "../services/schoolBellLocalApi";

export interface CloudCredentialSheetProps {
  open: boolean;
  onClose: () => void;
  baseUrl: string | null;
  onSaved: () => void;
}

/** The password is write-only — the device never returns it (see CloudConfig.mqttUsernameConfigured instead of echoing it back). */
export function CloudCredentialSheet({ open, onClose, baseUrl, onSaved }: CloudCredentialSheetProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!baseUrl) return;
    setBusy(true);
    try {
      await updateDeviceMqttCredential(baseUrl, { mqttUsername: username, mqttPassword: password, activateForCloudBroker: activate });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} open={open} subtitle="Used by the device's own MQTT client — never shown again once saved" title="MQTT credential">
      <div className="sb-field">
        <label>Username</label>
        <input onChange={(event) => setUsername(event.target.value)} type="text" value={username} />
      </div>
      <div className="sb-field">
        <label>Password</label>
        <input onChange={(event) => setPassword(event.target.value)} type="text" value={password} />
      </div>
      <div className="sb-field">
        <label>
          <input checked={activate} onChange={(event) => setActivate(event.target.checked)} type="checkbox" /> Connect to the broker
          now
        </label>
      </div>
      <button className="sb-btn primary" disabled={busy || !username || !password} onClick={handleSave} type="button">
        {busy ? "Saving…" : "Save credential"}
      </button>
    </Sheet>
  );
}
