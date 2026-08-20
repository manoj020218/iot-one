import { useEffect, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import {
  getSettings,
  listRfRemotes,
  updateSettings,
  type QrunlockSettings,
  type RelayPowerRestoreMode,
  type SwitchType
} from "../services/qrunlockApi";

const POWER_RESTORE_OPTIONS: Array<{ value: RelayPowerRestoreMode; label: string; hint: string }> = [
  { value: "on", label: "On", hint: "Relay always turns ON when power returns" },
  { value: "off", label: "Off", hint: "Relay always turns OFF when power returns" },
  { value: "remember", label: "Remember Last State", hint: "Restores whatever state it was in before power loss" }
];

const SWITCH_TYPE_OPTIONS: Array<{ value: SwitchType; label: string; hint: string }> = [
  { value: "reset", label: "Reset Type", hint: "Button always springs back after each press — default" },
  { value: "toggle", label: "Toggle Type", hint: "Button stays in position, flips state each press" },
  { value: "state", label: "State Type", hint: "Physical switch position always matches relay state" }
];

const POWER_RESTORE_LABEL: Record<RelayPowerRestoreMode, string> = {
  on: "On",
  off: "Off",
  remember: "Remember Last State"
};
const SWITCH_TYPE_LABEL: Record<SwitchType, string> = {
  reset: "Reset Type",
  toggle: "Toggle Type",
  state: "State Type"
};

export interface QrunlockSettingsPanelProps {
  session: AuthSession;
  deviceId: string;
  onOpenRfRemotes: () => void;
  onToast: (message: string) => void;
}

export function QrunlockSettingsPanel({ session, deviceId, onOpenRfRemotes, onToast }: QrunlockSettingsPanelProps) {
  const [settings, setSettings] = useState<QrunlockSettings | null>(null);
  const [remoteCount, setRemoteCount] = useState<number | null>(null);
  const [openSheet, setOpenSheet] = useState<"power" | "switch" | null>(null);

  useEffect(() => {
    let active = true;
    getSettings(session, deviceId)
      .then((result) => {
        if (active) setSettings(result);
      })
      .catch(() => undefined);
    listRfRemotes(session, deviceId)
      .then((result) => {
        if (active) setRemoteCount(result.length);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session, deviceId]);

  async function pickPowerRestore(value: RelayPowerRestoreMode) {
    setOpenSheet(null);
    try {
      const updated = await updateSettings(session, deviceId, { relayStateAfterPowerRestore: value });
      setSettings(updated);
    } catch {
      onToast("Couldn't save that setting — try again");
    }
  }

  async function pickSwitchType(value: SwitchType) {
    setOpenSheet(null);
    try {
      const updated = await updateSettings(session, deviceId, { switchType: value });
      setSettings(updated);
    } catch {
      onToast("Couldn't save that setting — try again");
    }
  }

  return (
    <div>
      <div className="qr-card" style={{ marginBottom: 14 }}>
        <button className="qr-row" onClick={onOpenRfRemotes} type="button">
          <span className="ic">
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <path d="M4 8a10 10 0 0 1 16 0" />
              <path d="M7 11a6 6 0 0 1 10 0" />
              <circle cx="12" cy="16" r="2" />
            </svg>
          </span>
          <span className="body">
            <span className="t">RF Remote Control Setup</span>
            <span className="s">{remoteCount === null ? "…" : `${remoteCount} remote${remoteCount === 1 ? "" : "s"} added`}</span>
          </span>
          <svg className="chev" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeWidth="3" viewBox="0 0 24 24" width="15">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="qr-card">
        <button className="qr-row" onClick={() => setOpenSheet("power")} type="button">
          <span className="ic">
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" x2="12" y1="2" y2="12" />
            </svg>
          </span>
          <span className="body">
            <span className="t">Relay Status After Power Restore</span>
            <span className="s">What the relay does after a power cut</span>
          </span>
          <span className="val">{settings ? POWER_RESTORE_LABEL[settings.relayStateAfterPowerRestore] : "…"}</span>
        </button>
        <button className="qr-row" onClick={() => setOpenSheet("switch")} type="button">
          <span className="ic">
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <rect height="12" rx="3" width="18" x="3" y="6" />
              <circle cx="9" cy="12" fill="currentColor" r="2" stroke="none" />
            </svg>
          </span>
          <span className="body">
            <span className="t">Switch Type Setting</span>
            <span className="s">How the physical button behaves</span>
          </span>
          <span className="val">{settings ? SWITCH_TYPE_LABEL[settings.switchType] : "…"}</span>
        </button>
      </div>

      <div className={`qr-scrim ${openSheet ? "open" : ""}`} onClick={() => setOpenSheet(null)} />
      <div className={`qr-sheet ${openSheet === "power" ? "open" : ""}`}>
        <div className="grab" />
        <div className="sh-title">Relay Status After Power Restore</div>
        {POWER_RESTORE_OPTIONS.map((option) => (
          <button
            className={`opt ${settings?.relayStateAfterPowerRestore === option.value ? "sel" : ""}`}
            key={option.value}
            onClick={() => void pickPowerRestore(option.value)}
            type="button"
          >
            <span className="t">
              {option.label}
              <small>{option.hint}</small>
            </span>
            <span className="dotcheck" />
          </button>
        ))}
      </div>
      <div className={`qr-sheet ${openSheet === "switch" ? "open" : ""}`}>
        <div className="grab" />
        <div className="sh-title">Switch Type Setting</div>
        {SWITCH_TYPE_OPTIONS.map((option) => (
          <button
            className={`opt ${settings?.switchType === option.value ? "sel" : ""}`}
            key={option.value}
            onClick={() => void pickSwitchType(option.value)}
            type="button"
          >
            <span className="t">
              {option.label}
              <small>{option.hint}</small>
            </span>
            <span className="dotcheck" />
          </button>
        ))}
      </div>
    </div>
  );
}
