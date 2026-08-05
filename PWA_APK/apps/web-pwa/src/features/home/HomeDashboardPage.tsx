import { AppShell } from "@jenix/ui";
import { useState } from "react";
import { FiBell, FiChevronDown } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { getCurrentHome } from "../dashboard/services/dashboardApi";
import { useNotifications } from "../notifications/hooks/useNotifications";
import { HomeDeviceSection } from "./components/HomeDeviceSection";
import { StatStrip } from "./components/StatStrip";
import { useDashboardDevices } from "../dashboard/hooks/useDashboardDevices";
import { useHomeDashboard } from "./hooks/useHomeDashboard";
import { useLiveMetrics } from "./hooks/useLiveMetrics";
import { type HomeFilter } from "./components/HomeFilterTabs";
import { useToast } from "./hooks/useToast";
import { HomeSelectorSheet } from "../homes/components/HomeSelectorSheet";
import { HomeFormSheet } from "../homes/components/HomeFormSheet";
import { createHome, listHomes, type HomeUpsertInput } from "../homes/services/homeApi";
import "./theme/home.css";

export function HomeDashboardPage() {
  const { session, replaceHomes, setActiveHome } = useAuth();
  const navigate = useNavigate();
  if (!session) throw new Error("HomeDashboardPage requires a session");
  const activeSession = session;
  const currentHome = getCurrentHome(activeSession);
  const { devices } = useDashboardDevices(activeSession);
  const { error } = useHomeDashboard(activeSession);
  const { metrics, togglePump } = useLiveMetrics(devices);
  const { unreadCount } = useNotifications(activeSession);
  const { toast, show } = useToast();
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const online = devices.filter((device) => device.online).length;
  const alerts = devices.filter((device) => metrics[device.deviceId]?.alert).length;

  async function handleCreateHome(input: HomeUpsertInput) {
    setSaving(true); setSaveError(null);
    try {
      const created = await createHome(activeSession, input);
      replaceHomes(await listHomes(activeSession), created.homeId);
      setFormOpen(false); show("Home created", `${created.name} is ready`);
    } catch (createError) {
      setSaveError(createError instanceof Error ? createError.message : "Unable to create home.");
    } finally { setSaving(false); }
  }

  return (
    <AppShell
      title={
        <button
          className="home-title-switch"
          onClick={() => setSelectorOpen(true)}
          type="button"
        >
          Home
          <FiChevronDown size={20} />
        </button>
      }
      aside={
        <button
          aria-label="Notifications"
          className="notification-bell-button"
          onClick={() => navigate("/notifications")}
          type="button"
        >
          <FiBell size={20} />
          {unreadCount > 0 ? (
            <span className="notification-bell-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      }
    >
      <StatStrip online={online} total={devices.length} alerts={alerts} />
      {error ? <section className="panel">{error}</section> : null}
      {currentHome.allowed === false ? <section className="panel">This home is linked to your account, but access is currently not allowed by the admin.</section> : <HomeDeviceSection devices={devices} filter={filter} homeName={currentHome.name} metrics={metrics} onChangeFilter={setFilter} onOpenDevice={(deviceId) => navigate(`/devices/${encodeURIComponent(deviceId)}`)} onTogglePump={(deviceId) => { togglePump(deviceId); show("Command sent", `${deviceId} pump toggled`); }} />}
      {toast ? <div className="jx-toast"><div><strong>{toast.title}</strong>{toast.detail ? <div style={{ color: "var(--muted)", fontSize: 12 }}>{toast.detail}</div> : null}</div></div> : null}
      <HomeSelectorSheet currentHomeId={currentHome.homeId} homes={activeSession.homes} onClose={() => setSelectorOpen(false)} onCreate={() => { setSelectorOpen(false); setFormOpen(true); }} onSelect={setActiveHome} open={selectorOpen} />
      <HomeFormSheet open={formOpen} title="Create Home" subtitle="Create a new home with its own device list, timezone, and member access." submitting={saving} error={saveError} onClose={() => setFormOpen(false)} onSubmit={handleCreateHome} />
    </AppShell>
  );
}
