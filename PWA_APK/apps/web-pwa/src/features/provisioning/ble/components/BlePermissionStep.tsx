export interface BlePermissionStepProps {
  mode: "native" | "demo";
  supported: boolean;
  loading?: boolean;
  onEnable: () => Promise<void> | void;
}

export function BlePermissionStep({
  mode,
  supported,
  loading = false,
  onEnable
}: BlePermissionStepProps) {
  return (
    <section className="form-card">
      <div>
        <span className="eyebrow">Step 1</span>
        <h2>Allow nearby device access</h2>
        <p>
          {supported
            ? "Enable the native Android BLE quick-scan path to discover nearby Jenix devices with the same two-pass search pattern proven in the FloodGuard installer build."
            : "Bluetooth Web APIs are unavailable in this browser, so the provisioning flow is running in demo scan mode."}
        </p>
      </div>
      <div className="provisioning-note">
        {mode === "native"
          ? "The scanner will first search by the Jenix name prefix, then retry with broader BLE matching if no direct prefix hit is found."
          : "Keep the device powered on and within installer range before starting the scan."}
      </div>
      <button
        className="primary-button"
        disabled={loading}
        onClick={() => void onEnable()}
        type="button"
      >
        {loading
          ? "Scanning nearby devices..."
          : supported
            ? "Start Quick BLE Scan"
            : "Start Demo Scan"}
      </button>
    </section>
  );
}
