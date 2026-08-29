import { FiCheck, FiX } from "react-icons/fi";

export interface PreflightCheckListProps {
  bluetoothEnabled: boolean;
  permissionDenied: boolean;
  onRetry: () => void;
}

/**
 * Gates Smart Mode (BLE) behind these two checks instead of starting a
 * scan that can never find anything and showing an inline warning next to
 * an empty list. Only two rows because that's all bleDiscoveryService.ts
 * actually reports: no separate device-level "Location Services" signal
 * exists in this app today (no geolocation plugin), so this deliberately
 * doesn't fabricate a third check with nothing real behind it. "Try again"
 * re-runs the exact same readiness flow, which itself already prompts the
 * OS to turn Bluetooth on / grant the permission (see
 * bleDiscoveryService.ts's ensureBleReady) -- there's no separate "fix"
 * action per row to wire up beyond that.
 */
export function PreflightCheckList({
  bluetoothEnabled,
  permissionDenied,
  onRetry
}: PreflightCheckListProps) {
  return (
    <section className="form-card">
      <div className="provisioning-header-row">
        <div>
          <span className="eyebrow">Before we start</span>
          <h2>Smart Mode needs these on</h2>
          <p>We use this to find your device nearby.</p>
        </div>
      </div>
      <div className="prov-check-list">
        <div className={`prov-check-row ${bluetoothEnabled ? "ok" : "bad"}`}>
          <span className="prov-check-status" aria-hidden="true">
            {bluetoothEnabled ? <FiCheck size={14} /> : <FiX size={14} />}
          </span>
          <div className="prov-check-text">
            <div className="prov-check-title">Bluetooth</div>
            <div className="prov-check-sub">{bluetoothEnabled ? "On" : "Turned off"}</div>
          </div>
        </div>
        <div className={`prov-check-row ${permissionDenied ? "bad" : "ok"}`}>
          <span className="prov-check-status" aria-hidden="true">
            {permissionDenied ? <FiX size={14} /> : <FiCheck size={14} />}
          </span>
          <div className="prov-check-text">
            <div className="prov-check-title">Nearby devices permission</div>
            <div className="prov-check-sub">{permissionDenied ? "Not granted" : "Granted"}</div>
          </div>
        </div>
      </div>
      <button className="primary-button" onClick={onRetry} type="button">
        Check again
      </button>
    </section>
  );
}
