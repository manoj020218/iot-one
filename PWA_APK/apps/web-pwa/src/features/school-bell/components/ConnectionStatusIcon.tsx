import { useState } from "react";
import { FiCloud, FiWifi, FiWifiOff } from "react-icons/fi";

import { Sheet } from "../../../app/components/Sheet";
import type { ConnectionMode } from "../services/useSchoolBellConnection";
import { LocalAddressSheet } from "./LocalAddressSheet";

export interface ConnectionStatusIconProps {
  mode: ConnectionMode;
  localAddress: string | null;
  cloudEnabled: boolean;
  onSaveLocalAddress: (address: string) => void;
  onRetry: () => void;
  canEdit: boolean;
}

const COPY: Record<ConnectionMode, { label: string; detail: string }> = {
  checking: { label: "Checking connection…", detail: "Looking for the bell on this Wi-Fi network." },
  local: { label: "Connected directly to the bell", detail: "Local Wi-Fi — schedule, ringing and settings all work with no internet." },
  "cloud-pending": {
    label: "Cloud control not available yet",
    detail: "The bell isn't reachable on this network, and remote control over the internet is coming with the paid plan — not live yet."
  },
  offline: { label: "Bell unreachable", detail: "Connect this phone to the school Wi-Fi the bell is on, or check its local address below." }
};

/**
 * Tap target for connection state — deliberately just an icon in the
 * header instead of a standing banner, to keep the Overview screen
 * compact (per feedback on the mockup). Full detail lives in the sheet.
 */
export function ConnectionStatusIcon({
  mode,
  localAddress,
  cloudEnabled,
  onSaveLocalAddress,
  onRetry,
  canEdit
}: ConnectionStatusIconProps) {
  const [open, setOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const copy = COPY[mode];
  const Icon = mode === "local" ? FiWifi : mode === "cloud-pending" ? FiCloud : FiWifiOff;
  const toneClass = mode === "local" ? "local" : mode === "cloud-pending" ? "cloud-pending" : "offline";

  return (
    <>
      <button
        aria-label={copy.label}
        className={`sb-conn-btn ${toneClass}`}
        onClick={() => setOpen(true)}
        title={copy.label}
        type="button"
      >
        <Icon size={17} />
        <span className="dot" />
      </button>

      <Sheet onClose={() => setOpen(false)} open={open} subtitle={copy.detail} title={copy.label}>
        <div className="sb-field">
          <label>Local network address</label>
          <div className="sb-row" style={{ padding: "10px 12px", border: "1px solid var(--line2)", borderRadius: 12 }}>
            <div className="body">
              <div className="t">{localAddress ?? "Not set"}</div>
              <div className="s">Tried first, every time — this is what makes control work without internet.</div>
            </div>
            {canEdit ? (
              <div className="r">
                <button className="sb-btn ghost" onClick={() => setEditingAddress(true)} type="button">
                  Edit
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="sb-field">
          <label>Cloud &amp; remote features</label>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {cloudEnabled ? "Enabled" : "Off"} — change this in Device settings → Connection mode.
          </div>
        </div>
        <button className="sb-btn primary" onClick={onRetry} type="button">
          Retry now
        </button>
      </Sheet>

      <LocalAddressSheet
        initialValue={localAddress}
        onClose={() => setEditingAddress(false)}
        onSave={(address) => {
          onSaveLocalAddress(address);
          setEditingAddress(false);
        }}
        open={editingAddress}
      />
    </>
  );
}
