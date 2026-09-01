import { useEffect, useState, type FormEvent } from "react";
import { FiEye, FiEyeOff, FiRefreshCw, FiWifi } from "react-icons/fi";

import type { WifiCredentialPayload } from "../provisioning.types";

export interface WifiCredentialFormProps {
  title: string;
  description: string;
  submitLabel: string;
  loading?: boolean;
  initialSsid?: string;
  /**
   * The phone's own currently-connected Wi-Fi SSID, if known (see
   * useCurrentWifiSsid) -- prefills the SSID field and, when it changes
   * (the user reconnects to a different network), replaces whatever the
   * field currently holds. `null` means "not detected yet / unavailable",
   * not "no network" -- the field falls back to initialSsid in that case.
   */
  detectedSsid?: string | null | undefined;
  detectingSsid?: boolean | undefined;
  onRefreshDetectedSsid?: (() => void) | undefined;
  /**
   * Shows a required "pairing code" field and includes it as
   * proofOfPossession in the submitted payload. Only the BLE flow needs
   * this (Security Scheme 2 pairing) -- the AP flow doesn't use it.
   */
  requireProofOfPossession?: boolean;
  /**
   * The device's real PoP, looked up from its factory record (captured by
   * the Flash Tool at flash time) -- same auto-fill-unless-touched pattern
   * as detectedSsid. undefined means "still looking it up", null means
   * "no factory record for this device", either of which leaves the field
   * as a manual fallback for the installer.
   */
  autoProofOfPossession?: string | null | undefined;
  autoProofOfPossessionLoading?: boolean | undefined;
  onSubmit: (payload: WifiCredentialPayload) => Promise<void> | void;
}

export function WifiCredentialForm({
  title,
  description,
  submitLabel,
  loading = false,
  initialSsid = "",
  detectedSsid,
  detectingSsid = false,
  onRefreshDetectedSsid,
  requireProofOfPossession = false,
  autoProofOfPossession,
  autoProofOfPossessionLoading = false,
  onSubmit
}: WifiCredentialFormProps) {
  const [ssid, setSsid] = useState(detectedSsid || initialSsid);
  const [ssidTouched, setSsidTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [proofOfPossession, setProofOfPossession] = useState(autoProofOfPossession || "");
  const [popTouched, setPopTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only auto-fill from a fresh detection if the user hasn't typed their
  // own SSID -- a user correcting a wrong/stale detected value shouldn't
  // have it silently overwritten a moment later.
  useEffect(() => {
    if (detectedSsid && !ssidTouched) {
      setSsid(detectedSsid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedSsid]);

  useEffect(() => {
    if (autoProofOfPossession && !popTouched) {
      setProofOfPossession(autoProofOfPossession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoProofOfPossession]);

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
    <form className="form-card wifi-cred-form" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <span className="eyebrow">Wi-Fi Setup</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="wifi-cred-notice">
        <FiWifi aria-hidden="true" />
        <span>
          This device only supports <strong>2.4 GHz</strong> Wi-Fi. Make sure your phone stays
          connected to a 2.4 GHz network — not 5 GHz — while you finish setup.
        </span>
      </div>

      <label className="field">
        <span>Wi-Fi SSID</span>
        <div className="wifi-cred-input-row">
          <FiWifi aria-hidden="true" className="wifi-cred-input-icon" />
          <input
            autoComplete="off"
            name="ssid"
            onChange={(event) => {
              setSsidTouched(true);
              setSsid(event.target.value);
            }}
            placeholder="Your 2.4 GHz network name"
            value={ssid}
          />
          {onRefreshDetectedSsid ? (
            <button
              aria-label="Detect current Wi-Fi network"
              className={`wifi-cred-detect-btn ${detectingSsid ? "spinning" : ""}`}
              onClick={onRefreshDetectedSsid}
              type="button"
            >
              <FiRefreshCw aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {detectedSsid ? (
          <span className="wifi-cred-hint">Detected from your phone's current connection.</span>
        ) : (
          <span className="wifi-cred-hint">
            Connect your phone to the 2.4 GHz network first — it'll be picked up automatically.
          </span>
        )}
      </label>

      <label className="field">
        <span>Wi-Fi Password</span>
        <div className="wifi-cred-input-row">
          <input
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter network password"
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="wifi-cred-detect-btn"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
          </button>
        </div>
      </label>

      {requireProofOfPossession && autoProofOfPossession ? (
        <div className="field">
          <span>Device pairing code</span>
          <span className="wifi-cred-hint">
            Verified automatically from this device's factory record -- no need to enter it.
          </span>
        </div>
      ) : requireProofOfPossession ? (
        <label className="field">
          <span>Device pairing code</span>
          <input
            autoComplete="off"
            name="proofOfPossession"
            onChange={(event) => {
              setPopTouched(true);
              setProofOfPossession(event.target.value);
            }}
            placeholder={
              autoProofOfPossessionLoading
                ? "Looking up this device's pairing code..."
                : "Printed on the device label / factory record"
            }
            value={proofOfPossession}
          />
          {autoProofOfPossessionLoading ? (
            <span className="wifi-cred-hint">Checking the factory record...</span>
          ) : (
            <span className="wifi-cred-hint">
              No factory record found -- enter the code printed on the device label.
            </span>
          )}
        </label>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <button className="primary-button" disabled={loading} type="submit">
        {loading ? "Sending Wi-Fi credentials..." : submitLabel}
      </button>
    </form>
  );
}
