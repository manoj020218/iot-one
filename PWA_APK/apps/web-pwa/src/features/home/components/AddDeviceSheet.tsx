import { useEffect, useState } from "react";
import { FiX, FiWifi, FiCheckCircle, FiBox } from "react-icons/fi";

export interface DiscoveredDevice {
  id: string;
  name: string;
  pid: string;
  pidLabel: string;
}

export interface AddDeviceSheetProps {
  onClose: () => void;
  onAdded: (device: DiscoveredDevice, displayName: string) => void;
}

// Demo discovery. Replace with BLE/AP provisioning results — see
// DEVICE_INTEGRATION_GUIDE.md → "Provisioning". Shape stays identical.
const DISCOVERED: DiscoveredDevice[] = [
  { id: "jx-tgd-a1", name: "Tank Guard A1", pid: "JX-TGD-01", pidLabel: "Tank Guard" },
  { id: "jx-tgd-b7", name: "Tank Guard B7", pid: "JX-TGD-01", pidLabel: "Tank Guard" }
];

type Step = "scan" | "pick" | "name" | "done";

export function AddDeviceSheet({ onClose, onAdded }: AddDeviceSheetProps) {
  const [step, setStep] = useState<Step>("scan");
  const [picked, setPicked] = useState<DiscoveredDevice | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (step !== "scan") return undefined;
    const timer = setTimeout(() => setStep("pick"), 2200);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <>
      <div className="jx-scrim" onClick={onClose} />
      <aside className="jx-sheet" role="dialog" aria-label="Add device">
        <div className="grab" />
        <div className="jx-sh">
          <div>
            <h3>Add a device</h3>
            <div className="sub">Same Wi-Fi · device in pairing mode</div>
          </div>
          <button className="jx-close" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="jx-sb">
          {step === "scan" ? (
            <div className="jx-scan">
              <div className="jx-radar">
                <span className="pw" />
                <span className="pw" />
                <span className="pw" />
                <span className="core" />
              </div>
              <h3 style={{ fontSize: 17 }}>Scanning for Jenix devices…</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                Hold the button on your device until the light blinks.
              </p>
            </div>
          ) : null}

          {step === "pick" ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 4 }}>
                {DISCOVERED.length} devices found nearby
              </p>
              {DISCOVERED.map((device) => (
                <button
                  key={device.id}
                  className="jx-found"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setPicked(device);
                    setName(device.name);
                    setStep("name");
                  }}
                >
                  <span className="di">
                    <FiWifi size={20} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, display: "block" }}>{device.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{device.pidLabel} · {device.pid}</span>
                  </span>
                </button>
              ))}
            </>
          ) : null}

          {step === "name" && picked ? (
            <>
              <div className="jx-blk" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="di">
                  <FiBox size={20} />
                </span>
                <div>
                  <div style={{ fontWeight: 700 }}>{picked.pidLabel}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{picked.pid}</div>
                </div>
              </div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Name this device</label>
              <input
                className="jx-input"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Overhead Tank"
              />
              <button
                className="jx-btn primary block"
                disabled={!name.trim()}
                style={{ opacity: name.trim() ? 1 : 0.5 }}
                onClick={() => {
                  onAdded(picked, name.trim());
                  setStep("done");
                }}
              >
                Add to Farmhouse
              </button>
            </>
          ) : null}

          {step === "done" ? (
            <div className="jx-scan">
              <div style={{ color: "var(--green)", marginBottom: 14 }}>
                <FiCheckCircle size={64} />
              </div>
              <h3 style={{ fontSize: 18 }}>Device added!</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                {name} is now live on your dashboard.
              </p>
              <button className="jx-btn primary block" style={{ marginTop: 22 }} onClick={onClose}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
