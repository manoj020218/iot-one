import type { HomeAccessRole } from "@jenix/shared";
import { canWriteToHome } from "@jenix/shared";

/**
 * Role gating for this plugin, built on the platform's own HomeAccessRole
 * (owner/admin/member/viewer) — the approved design decision was to use
 * these HOME roles directly rather than inventing School-Bell-specific
 * ones. Three tiers matter here:
 *  - viewer: read-only everywhere
 *  - member: can additionally ring the bell (the one action a teacher
 *    needs day-to-day)
 *  - admin/owner: full schedule/settings/danger-zone control
 */
export function canRingBell(role: HomeAccessRole): boolean {
  return canWriteToHome(role);
}

export function canManageSchedule(role: HomeAccessRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageDangerZone(role: HomeAccessRole): boolean {
  return role === "owner";
}
