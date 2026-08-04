import { AppShell } from "@jenix/ui";
import { getCurrentHome } from "@jenix/shared";
import { useEffect, useState } from "react";
import { FiChevronRight, FiClock, FiDownload, FiHome } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { Sheet } from "../../app/components/Sheet";
import { useAuth } from "../auth/hooks/useAuth";
import { homeTimezoneOptions } from "../homes/constants/homeTimezones";
import { listHomes, updateHome } from "../homes/services/homeApi";
import { getAppUpdateStatus, type AppUpdateStatus } from "./services/appUpdateApi";
import { avatarColorFor, initials } from "./utils/avatar";

export function SettingsHomePage() {
  const { session, replaceHomes } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    throw new Error("SettingsHomePage requires an authenticated session");
  }

  const activeSession = session;
  const currentHome = getCurrentHome(
    activeSession.homes,
    activeSession.user.userId,
    activeSession.activeHomeId
  );

  const [tzOpen, setTzOpen] = useState(false);
  const [tzValue, setTzValue] = useState(currentHome.timezone ?? "Asia/Kolkata");
  const [tzSaving, setTzSaving] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);

  useEffect(() => {
    void getAppUpdateStatus().then(setUpdateStatus);
  }, []);

  async function handleSaveTimezone() {
    setTzSaving(true);
    setTzError(null);

    try {
      await updateHome(activeSession, currentHome.homeId, {
        name: currentHome.name,
        timezone: tzValue,
        ...(currentHome.locationLabel ? { locationLabel: currentHome.locationLabel } : {}),
        ...(currentHome.latitude !== undefined ? { latitude: currentHome.latitude } : {}),
        ...(currentHome.longitude !== undefined ? { longitude: currentHome.longitude } : {})
      });
      replaceHomes(await listHomes(activeSession), currentHome.homeId);
      setTzOpen(false);
    } catch (saveError) {
      setTzError(saveError instanceof Error ? saveError.message : "Unable to save timezone.");
    } finally {
      setTzSaving(false);
    }
  }

  return (
    <AppShell eyebrow="Settings" title="Settings">
      <article className="panel home-list-item" style={{ marginBottom: 16 }}>
        <button
          className="settings-row"
          onClick={() => navigate("/settings/profile")}
          type="button"
        >
          <span className="avatar" style={{ background: avatarColorFor(activeSession.user.userId) }}>
            {initials(activeSession.user.name)}
          </span>
          <span className="settings-row-label">
            <strong>{activeSession.user.name}</strong>
            <span>{activeSession.user.email}</span>
          </span>
          <FiChevronRight className="settings-row-chev" size={18} />
        </button>
      </article>

      <div className="settings-list">
        <button className="settings-row" onClick={() => navigate("/settings/homes")} type="button">
          <span className="settings-row-icon">
            <FiHome size={17} />
          </span>
          <span className="settings-row-label">
            <strong>Home Management</strong>
            <span>{activeSession.homes.length === 1 ? "1 home" : `${activeSession.homes.length} homes`}</span>
          </span>
          <FiChevronRight className="settings-row-chev" size={16} />
        </button>

        <button className="settings-row" onClick={() => setTzOpen(true)} type="button">
          <span className="settings-row-icon">
            <FiClock size={17} />
          </span>
          <span className="settings-row-label">
            <strong>Time Zone</strong>
            <span>{currentHome.name}</span>
          </span>
          <span className="settings-row-value">{currentHome.timezone ?? "Asia/Kolkata"}</span>
          <FiChevronRight className="settings-row-chev" size={16} />
        </button>

        <button className="settings-row" onClick={() => navigate("/settings/app")} type="button">
          <span className="settings-row-icon">
            <FiDownload size={17} />
          </span>
          <span className="settings-row-label">
            <strong>App Update</strong>
            <span>{updateStatus?.currentVersion ?? "Checking..."}</span>
          </span>
          <span className="settings-row-value">
            {updateStatus ? (updateStatus.hasUpdate ? "Update available" : "Up to date") : ""}
          </span>
          <FiChevronRight className="settings-row-chev" size={16} />
        </button>
      </div>

      <Sheet
        actions={
          <>
            <button className="secondary-button" onClick={() => setTzOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={tzSaving}
              onClick={() => void handleSaveTimezone()}
              type="button"
            >
              {tzSaving ? "Saving..." : "Save Time Zone"}
            </button>
          </>
        }
        onClose={() => setTzOpen(false)}
        open={tzOpen}
        subtitle={`Reporting time zone for ${currentHome.name}.`}
        title="Time Zone"
      >
        <label className="field">
          <span>Time Zone</span>
          <select onChange={(event) => setTzValue(event.target.value)} value={tzValue}>
            {homeTimezoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {tzError ? <p className="inline-error">{tzError}</p> : null}
      </Sheet>
    </AppShell>
  );
}
