import type { AuthSession, HomeRecord } from "@jenix/shared";

import { getCurrentHome } from "../services/dashboardApi";

export function useCurrentHome(session: AuthSession): HomeRecord {
  return getCurrentHome(session);
}
