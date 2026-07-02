import type { ApSetupDescriptor } from "../services/apProvisioningService";

export interface ApInstructionStepProps {
  descriptor: ApSetupDescriptor;
  onContinue: () => void;
}

export function ApInstructionStep({
  descriptor,
  onContinue
}: ApInstructionStepProps) {
  return (
    <section className="form-card">
      <div>
        <span className="eyebrow">Step 1</span>
        <h2>Join the device hotspot</h2>
        <p>
          Connect your phone or installer laptop to <strong>{descriptor.apSsid}</strong>
          , then return here to send the site Wi-Fi credentials.
        </p>
      </div>
      <ol className="instruction-list">
        <li>Power on the device and wait for AP commissioning mode.</li>
        <li>Open Wi-Fi settings and join the Jenix setup hotspot.</li>
        <li>Return to this flow once the hotspot connection is stable.</li>
      </ol>
      <button className="primary-button" onClick={onContinue} type="button">
        I connected to the hotspot
      </button>
    </section>
  );
}
