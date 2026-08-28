import { useState, type FormEvent } from "react";

import type { WifiCredentialPayload } from "../provisioning.types";

export interface WifiCredentialFormProps {
  title: string;
  description: string;
  submitLabel: string;
  loading?: boolean;
  initialSsid?: string;
  /**
   * Shows a required "pairing code" field and includes it as
   * proofOfPossession in the submitted payload. Only the BLE flow needs
   * this (Security Scheme 2 pairing) -- the AP flow doesn't use it.
   */
  requireProofOfPossession?: boolean;
  onSubmit: (payload: WifiCredentialPayload) => Promise<void> | void;
}

export function WifiCredentialForm({
  title,
  description,
  submitLabel,
  loading = false,
  initialSsid = "",
  requireProofOfPossession = false,
  onSubmit
}: WifiCredentialFormProps) {
  const [ssid, setSsid] = useState(initialSsid);
  const [password, setPassword] = useState("");
  const [proofOfPossession, setProofOfPossession] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ssid.trim() || !password.trim()) {
      setError("SSID and password are required to continue provisioning.");
      return;
    }

    if (requireProofOfPossession && !proofOfPossession.trim()) {
      setError("This device's pairing code is required to continue provisioning.");
      return;
    }

    setError(null);
    await onSubmit({
      ssid: ssid.trim(),
      password: password.trim(),
      ...(requireProofOfPossession
        ? { proofOfPossession: proofOfPossession.trim() }
        : {})
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
      {requireProofOfPossession ? (
        <label className="field">
          <span>Device pairing code</span>
          <input
            autoComplete="off"
            name="proofOfPossession"
            onChange={(event) => setProofOfPossession(event.target.value)}
            placeholder="Printed on the device label / factory record"
            value={proofOfPossession}
          />
        </label>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <button className="primary-button" disabled={loading} type="submit">
        {loading ? "Sending Wi-Fi credentials..." : submitLabel}
      </button>
    </form>
  );
}
