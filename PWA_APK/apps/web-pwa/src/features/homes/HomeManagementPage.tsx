import { AppShell, StatusPill } from "@jenix/ui";
import { getCurrentHome } from "@jenix/shared";

import { useAuth } from "../auth/hooks/useAuth";
import { HomeManagementSection } from "../settings/components/HomeManagementSection";

export function HomeManagementPage() {
  const { session } = useAuth();
  if (!session) throw new Error("HomeManagementPage requires an authenticated session");
  const currentHome = getCurrentHome(session.homes, session.user.userId, session.activeHomeId);

  return (
    <AppShell eyebrow="Homes" title="Multi-Home Access Control" description="Manage homes, join invites, and control member permissions with the same professional flow used in settings." aside={<StatusPill label={currentHome.role.toUpperCase()} tone="neutral" />}>
      <HomeManagementSection />
    </AppShell>
  );
}
