import { useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";

export interface RemoveDeviceSheetProps {
  deviceName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Tuya-style "long-press a tile to remove it" confirmation. Confirming
 * unpairs the device from this account and best-effort factory-resets the
 * physical unit so it re-enters provisioning mode (device.service.ts's
 * removeDevice) -- worth spelling out here since "Remove" alone doesn't
 * make that second half obvious.
 */
export function RemoveDeviceSheet({ deviceName, onCancel, onConfirm }: RemoveDeviceSheetProps) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setRemoving(true);
    setError(null);
    try {
      await onConfirm();
    } catch (confirmError) {
      setRemoving(false);
      setError(
        confirmError instanceof Error ? confirmError.message : "Couldn't remove this device."
      );
    }
  }

  return (
    <>
      <div className="jx-scrim" onClick={removing ? undefined : onCancel} />
      <aside className="jx-sheet" role="dialog" aria-label="Remove device">
        <div className="grab" />
        <div className="jx-sh">
          <div>
            <h3>Remove device</h3>
            <div className="sub">{deviceName}</div>
          </div>
          <button className="jx-close" onClick={onCancel} disabled={removing} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="jx-sb">
          <div className="jx-blk" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span style={{ color: "var(--red)", flexShrink: 0, marginTop: 2 }}>
              <FiAlertTriangle size={22} />
            </span>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--txt)" }}>
              This removes <strong>{deviceName}</strong> from your account and tells the device
              to reset, so it's ready to be added again. If it's offline right now, the reset
              will only happen once it's powered back on and reconnects.
            </p>
          </div>

          {error ? <p className="inline-error">{error}</p> : null}

          <button
            className="jx-btn danger block"
            disabled={removing}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {removing ? "Removing..." : "Remove device"}
          </button>
          <button
            className="jx-btn ghost block"
            disabled={removing}
            onClick={onCancel}
            style={{ marginTop: 10 }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </aside>
    </>
  );
}
