import { AppShell, StatusPill } from "@jenix/ui";
import { getCurrentHome } from "@jenix/shared";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { listHomes, updateHome } from "../homes/services/homeApi";
import { AppUpdateStatusCard } from "./components/AppUpdateStatusCard";
import { HomeManagementSection } from "./components/HomeManagementSection";
import { HomeTimezoneCard } from "./components/HomeTimezoneCard";

export function SettingsHomePage() {
  const { session, replaceHomes } = useAuth();
  const navigate = useNavigate();
  if (!session) throw new Error("SettingsHomePage requires an authenticated session");
  const activeSession = session;
  const currentHome = getCurrentHome(
    activeSession.homes,
    activeSession.user.userId,
    activeSession.activeHomeId
  );

  async function handleTimezoneSave(timezone: string) {
    await updateHome(activeSession, currentHome.homeId, {
      name: currentHome.name,
      timezone,
      ...(currentHome.locationLabel ? { locationLabel: currentHome.locationLabel } : {}),
      ...(currentHome.latitude !== undefined ? { latitude: currentHome.latitude } : {}),
      ...(currentHome.longitude !== undefined ? { longitude: currentHome.longitude } : {})
    });
    replaceHomes(await listHomes(activeSession), currentHome.homeId);
  }

  return (
    <AppShell eyebrow="Settings" title="Home, Access, and App Controls" description="Configure the active home, manage members, and keep the Jenix One shell current." aside={<StatusPill label={currentHome.name} tone="neutral" />}>
      <section className="settings-card-grid">
        <button className="home-card-button" onClick={() => navigate("/settings/profile")} type="button">
          <div className="home-card-head"><strong>User Profile</strong><span>{activeSession.user.name}</span></div>
          <p className="hint-text">Review account identity and the homes tied to this login.</p>
        </button>
        <HomeTimezoneCard currentHome={currentHome} onSave={handleTimezoneSave} />
        <AppUpdateStatusCard />
      </section>
      <HomeManagementSection />
    </AppShell>
  );
}
