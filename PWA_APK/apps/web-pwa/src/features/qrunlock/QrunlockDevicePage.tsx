import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@jenix/shared";
import { useNavigate } from "react-router-dom";

import { DeviceTimerPanel, type DeviceTimerMode } from "../devices/components/DeviceTimerPanel";
import { ActivityFeed } from "./components/ActivityFeed";
import { LockHero } from "./components/LockHero";
import { QrunlockInchingPanel } from "./components/QrunlockInchingPanel";
import { QrunlockSettingsPanel } from "./components/QrunlockSettingsPanel";
import { RenameDeviceSheet } from "./components/RenameDeviceSheet";
import { RfRemoteSetupScreen } from "./components/RfRemoteSetupScreen";
import "./qrunlock.css";
import { getQrunlockDevice, renameDevice, type QrunlockDeviceSummary } from "./services/qrunlockApi";

type MainTab = "lock" | "timer" | "settings";
type SubScreen = "logs" | "rf-remotes" | null;

export interface QrunlockDevicePageProps {
  session: AuthSession;
  deviceId: string;
  onDeviceListRequested?: () => void;
}

export function QrunlockDevicePage({ session, deviceId, onDeviceListRequested }: QrunlockDevicePageProps) {
  const navigate = useNavigate();
  const [device, setDevice] = useState<QrunlockDeviceSummary | null>(null);
  const [tab, setTab] = useState<MainTab>("lock");
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [timerMode, setTimerMode] = useState<DeviceTimerMode>("countdown");
  const [renameOpen, setRenameOpen] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const loadDevice = useCallback(() => {
    getQrunlockDevice(session, deviceId)
      .then(setDevice)
      .catch(() => undefined);
  }, [session, deviceId]);

  useEffect(loadDevice, [loadDevice]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function handleUnlocked() {
    setActivityRefreshKey((value) => value + 1);
    loadDevice();
  }

  async function handleRename(name: string) {
    try {
      await renameDevice(session, deviceId, name);
      loadDevice();
      showToast("Device renamed");
    } catch {
      showToast("Couldn't rename — try again");
    }
  }

  if (subScreen === "rf-remotes") {
    return (
      <RfRemoteSetupScreen
        deviceId={deviceId}
        onBack={() => setSubScreen(null)}
        onToast={showToast}
        session={session}
      />
    );
  }

  if (subScreen === "logs") {
    return (
      <div className="qr-page">
        <div className="qr-sub-head">
          <button aria-label="Back" className="iconbtn" onClick={() => setSubScreen(null)} type="button">
            <svg fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="17">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="titles">
            <div className="nm">Activity Logs</div>
          </div>
        </div>
        <ActivityFeed deviceId={deviceId} refreshKey={activityRefreshKey} session={session} />
      </div>
    );
  }

  return (
    <div className="qr-page">
      <div className="qr-head">
        <button
          aria-label="Back"
          className="iconbtn"
          onClick={() => (onDeviceListRequested ? onDeviceListRequested() : navigate("/home"))}
          type="button"
        >
          <svg fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="17">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="titles">
          <div className="nm">{device?.friendlyName ?? "QRunlock"}</div>
          <div className="st">
            <span className={`dot ${device?.onlineStatus === "offline" ? "offline" : ""}`} />
            {device?.onlineStatus === "offline" ? "Offline" : "Online"} &middot; QRunlock
          </div>
        </div>
        <button aria-label="Rename device" className="iconbtn" onClick={() => setRenameOpen(true)} type="button">
          <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      </div>

      <div className="qr-seg">
        <button className={tab === "lock" ? "on" : ""} onClick={() => setTab("lock")} type="button">
          Lock
        </button>
        <button className={tab === "timer" ? "on" : ""} onClick={() => setTab("timer")} type="button">
          Timer
        </button>
        <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")} type="button">
          Settings
        </button>
      </div>

      {tab === "lock" ? (
        <>
          <LockHero deviceId={deviceId} onToast={showToast} onUnlocked={handleUnlocked} session={session} />
          <div className="qr-section">
            <div className="qr-section-head">
              <h2>Recent activity</h2>
              <button className="link" onClick={() => setSubScreen("logs")} type="button">
                See logs
                <svg fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeWidth="3" viewBox="0 0 24 24" width="12">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            <ActivityFeed deviceId={deviceId} limit={3} refreshKey={activityRefreshKey} session={session} />
          </div>
        </>
      ) : null}

      {tab === "timer" ? (
        <DeviceTimerPanel
          active={timerMode}
          onChange={setTimerMode}
          panels={{ inching: <QrunlockInchingPanel deviceId={deviceId} session={session} /> }}
        />
      ) : null}

      {tab === "settings" ? (
        <QrunlockSettingsPanel
          deviceId={deviceId}
          onOpenRfRemotes={() => setSubScreen("rf-remotes")}
          onToast={showToast}
          session={session}
        />
      ) : null}

      <RenameDeviceSheet
        currentName={device?.friendlyName ?? ""}
        onClose={() => setRenameOpen(false)}
        onSave={handleRename}
        open={renameOpen}
      />

      <div className={`qr-toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
