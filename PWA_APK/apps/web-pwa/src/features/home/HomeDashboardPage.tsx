import { AppShell, StatusPill } from "@jenix/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { getCurrentHome } from "../dashboard/services/dashboardApi";
import { HomeHeroPanel } from "./components/HomeHeroPanel";
import { HomeDeviceSection } from "./components/HomeDeviceSection";
import { StatStrip } from "./components/StatStrip";
import { useDashboardDevices } from "../dashboard/hooks/useDashboardDevices";
import { useHomeDashboard } from "./hooks/useHomeDashboard";
import { useLiveMetrics } from "./hooks/useLiveMetrics";
import { type HomeFilter } from "./components/HomeFilterTabs";
import { useToast } from "./hooks/useToast";
import { litres } from "./telemetry/deviceTelemetry";
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
  const { dashboard, error } = useHomeDashboard(activeSession);
  const { metrics, togglePump } = useLiveMetrics(devices);
  const { toast, show } = useToast();
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const online = devices.filter((device) => device.online).length;
  const alerts = devices.filter((device) => metrics[device.deviceId]?.alert).length;
  const water = devices.reduce((sum, device) => {
    const deviceMetrics = metrics[device.deviceId];
    return sum + (deviceMetrics ? litres(deviceMetrics) : 0);
  }, 0);

  async function handleCreateHome(input: HomeUpsertInput) {
    setSaving(true); setSaveError(null);
    try {
      const created = await createHome(activeSession, input);
      replaceHomes(await listHomes(activeSession), created.homeId);
      setFormOpen(false); show("Home created", `${created.name} is ready`);
    } catch (createError) {
      setSaveError(createError instanceof Error ? createError.message : "Unable to create HOME.");
    } finally { setSaving(false); }
  }

  return (
    <AppShell eyebrow="Home" title={currentHome.name} description="Live devices, members, and automations follow the selected home context." aside={<StatusPill label={(dashboard?.timezone ?? currentHome.timezone ?? "India").toUpperCase()} tone="neutral" />}>
      <HomeHeroPanel currentHome={currentHome} dashboard={dashboard} loading={!dashboard && !error} onCreateHome={() => setFormOpen(true)} onOpenSelector={() => setSelectorOpen(true)} userName={activeSession.user.name} />
      <StatStrip online={online} total={devices.length} waterLitres={water} alerts={alerts} />
      {error ? <section className="panel">{error}</section> : null}
      {currentHome.allowed === false ? <section className="panel">This home is linked to your account, but access is currently not allowed by the admin.</section> : <HomeDeviceSection devices={devices} filter={filter} metrics={metrics} onChangeFilter={setFilter} onOpenDevice={(deviceId) => navigate(`/devices/${encodeURIComponent(deviceId)}`)} onTogglePump={(deviceId) => { togglePump(deviceId); show("Command sent", `${deviceId} pump toggled`); }} />}
      {toast ? <div className="jx-toast"><div><strong>{toast.title}</strong>{toast.detail ? <div style={{ color: "var(--muted)", fontSize: 12 }}>{toast.detail}</div> : null}</div></div> : null}
      <HomeSelectorSheet currentHomeId={currentHome.homeId} homes={activeSession.homes} onClose={() => setSelectorOpen(false)} onCreate={() => { setSelectorOpen(false); setFormOpen(true); }} onSelect={setActiveHome} open={selectorOpen} />
      <HomeFormSheet open={formOpen} title="Create Home" subtitle="Create a new home with its own device list, timezone, and member access." submitting={saving} error={saveError} onClose={() => setFormOpen(false)} onSubmit={handleCreateHome} />
    </AppShell>
  );
}
