import { AppShell, StatusPill } from "@jenix/ui";
import { getCurrentHome } from "@jenix/shared";

import { useAuth } from "../auth/hooks/useAuth";
import { AppUpdateStatusCard } from "./components/AppUpdateStatusCard";

export function AppUpdatePage() {
  const { session } = useAuth();
  if (!session) throw new Error("AppUpdatePage requires an authenticated session");
  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  return (
    <AppShell eyebrow="App Update" title="PWA and Wrapper Update Status" description="Check the current shell version, compare with the published release, and apply the next app update when available." aside={<StatusPill label={currentHome.name} tone="neutral" />}>
      <AppUpdateStatusCard />
    </AppShell>
  );
}
