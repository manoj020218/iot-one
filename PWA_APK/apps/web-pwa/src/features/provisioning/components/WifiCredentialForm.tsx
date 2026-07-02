import { useState, type FormEvent } from "react";

import type { WifiCredentialPayload } from "../provisioning.types";

export interface WifiCredentialFormProps {
  title: string;
  description: string;
  submitLabel: string;
  loading?: boolean;
  initialSsid?: string;
  onSubmit: (payload: WifiCredentialPayload) => Promise<void> | void;
}

export function WifiCredentialForm({
  title,
  description,
  submitLabel,
  loading = false,
  initialSsid = "",
  onSubmit
}: WifiCredentialFormProps) {
  const [ssid, setSsid] = useState(initialSsid);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ssid.trim() || !password.trim()) {
      setError("SSID and password are required to continue provisioning.");
      return;
    }

    setError(null);
    await onSubmit({
      ssid: ssid.trim(),
      password: password.trim()
    });
  }

  return (
    <form className="form-card" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <span className="eyebrow">Wi-Fi Setup</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <label className="field">
        <span>Wi-Fi SSID</span>
        <input
          autoComplete="off"
          name="ssid"
          onChange={(event) => setSsid(event.target.value)}
          placeholder="Factory 2.4 GHz"
          value={ssid}
        />
      </label>
      <label className="field">
        <span>Wi-Fi Password</span>
        <input
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter network password"
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="inline-error">{error}</p> : null}
      <button className="primary-button" disabled={loading} type="submit">
        {loading ? "Sending Wi-Fi credentials..." : submitLabel}
      </button>
    </form>
  );
}
