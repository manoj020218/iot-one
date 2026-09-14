import { useState } from "react";
import { FiCheck, FiCopy, FiWifi } from "react-icons/fi";

import type { ApSetupDescriptor } from "../services/apProvisioningService";

export interface ApInstructionStepProps {
  descriptor: ApSetupDescriptor;
  onContinue: () => void;
}

export function ApInstructionStep({
  descriptor,
  onContinue
}: ApInstructionStepProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopySsid() {
    try {
      await navigator.clipboard.writeText(descriptor.apSsid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be denied (permissions, non-HTTPS context) --
      // the SSID is still visible to copy by hand, so this is a soft failure.
    }
  }

  return (
    <section className="form-card apv2-panel">
      <div className="apv2-hero-icon apv2-hero-accent">
        <FiWifi aria-hidden="true" />
      </div>
      <span className="eyebrow">Step 1 of 3</span>
      <h2>Join the device hotspot</h2>
      <p>
        Connect your phone or installer laptop to the network below, then come back to
        send this site&apos;s Wi-Fi.
      </p>

      <div className="apv2-ssid-card">
        <div>
          <span className="apv2-ssid-label">Hotspot name</span>
          <span className="apv2-ssid-value">{descriptor.apSsid}</span>
        </div>
        <button
          aria-label="Copy hotspot name"
          className={`apv2-copy-btn ${copied ? "apv2-copied" : ""}`}
          onClick={() => void handleCopySsid()}
          type="button"
        >
          {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
        </button>
      </div>

      <ol className="apv2-steps">
        <li>Power on the device and wait for it to enter setup mode.</li>
        <li>Open Wi-Fi settings and join the hotspot above.</li>
        <li>Come back here once the connection looks stable.</li>
      </ol>
      <button className="apv2-btn apv2-btn-primary" onClick={onContinue} type="button">
        I&apos;m connected to the hotspot
      </button>
    </section>
  );
}
