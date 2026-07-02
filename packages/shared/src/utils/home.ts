import type { HomeRecord } from "../types/home";

export function createDefaultHome(ownerUserId: string, now = new Date()): HomeRecord {
  const timestamp = now.toISOString();

  return {
    homeId: `home-${ownerUserId.toLowerCase()}`,
    name: "HOME",
    ownerUserId,
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function ensureDefaultHome(
  homes: HomeRecord[],
  ownerUserId: string,
  now = new Date()
): HomeRecord[] {
  if (homes.some((home) => home.ownerUserId === ownerUserId && home.isDefault)) {
    return homes;
  }

  return [createDefaultHome(ownerUserId, now), ...homes];
}
