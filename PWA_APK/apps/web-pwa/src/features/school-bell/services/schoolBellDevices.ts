import type { AuthSession } from "@jenix/shared";

import { listManagedDevices, type ManagedDeviceSummary } from "../../devices/services/deviceManagementApi";
import { SCHOOL_BELL_PID } from "../schoolBellPid";

/**
 * No School-Bell-specific backend module exists yet (unlike QRunlock's own
 * /api/v1/qrunlock/devices) — reuses the platform's generic device listing
 * and filters by PID client-side, same as any other PID would until it
 * earns a dedicated module.
 */
export async function listSchoolBellDevices(session: AuthSession): Promise<ManagedDeviceSummary[]> {
  const devices = await listManagedDevices(session);
  return devices.filter((device) => device.pid === SCHOOL_BELL_PID);
}
