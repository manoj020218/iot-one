import type { AuthSession, HomeDashboardResponse } from "@jenix/shared";
import { useEffect, useState } from "react";

import { getCurrentHome } from "../../dashboard/services/dashboardApi";
import { getHomeDashboard } from "../../homes/services/homeApi";

export function useHomeDashboard(session: AuthSession) {
  const currentHome = getCurrentHome(session);
  const [dashboard, setDashboard] = useState<HomeDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      setDashboard(await getHomeDashboard(session, currentHome.homeId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load HOME dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [currentHome.homeId, session.user.userId]);

  return {
    dashboard,
    loading,
    error,
    reload: load
  };
}
