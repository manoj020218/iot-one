import { mobileTabs } from "@jenix/shared";
import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { DeviceGrid } from "./components/DeviceGrid";
import { HomeTopBar } from "./components/HomeTopBar";
import { useCurrentHome } from "./hooks/useCurrentHome";
import { useDashboardDevices } from "./hooks/useDashboardDevices";

export function DashboardPage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    throw new Error("DashboardPage requires an authenticated session");
  }

  const currentHome = useCurrentHome(session);
  const { devices, loading, error, rename } = useDashboardDevices(session);

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Jenix One Dashboard"
      description="The foundation dashboard creates a default HOME when needed and prepares the device grid for PID-aware provisioning and telemetry."
      aside={<StatusPill label={session.user.provider.toUpperCase()} tone="neutral" />}
    >
      <HomeTopBar
        home={currentHome}
        onAddDevice={() => navigate("/provisioning")}
        userName={session.user.name}
      />
      <section className="tabs-strip">
        {mobileTabs.map((tab) => (
          <StatusPill key={tab} label={tab} tone="neutral" />
        ))}
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/scenes")}
        >
          Scenes
        </button>
        <button className="text-button" type="button" onClick={logout}>
          Logout
        </button>
      </section>
      {loading ? <section className="panel">Loading devices...</section> : null}
      {error ? <section className="panel">{error}</section> : null}
      {!loading ? <DeviceGrid devices={devices} onRename={rename} /> : null}
    </AppShell>
  );
}
