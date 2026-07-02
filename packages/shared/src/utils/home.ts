import type {
  HomeAccessRole,
  HomeMemberRecord,
  HomeRecord
} from "../types/home";

export function createDefaultHome(ownerUserId: string, now = new Date()): HomeRecord {
  const timestamp = now.toISOString();

  return {
    homeId: `home-${ownerUserId.toLowerCase()}`,
    name: "HOME",
    ownerUserId,
    role: "owner",
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

export function getCurrentHome(
  homes: HomeRecord[],
  ownerUserId: string,
  activeHomeId?: string
): HomeRecord {
  const normalizedHomes = ensureDefaultHome(homes, ownerUserId);

  if (activeHomeId) {
    const activeHome = normalizedHomes.find((home) => home.homeId === activeHomeId);

    if (activeHome) {
      return activeHome;
    }
  }

  return normalizedHomes[0]!;
}

export function canWriteToHome(role: HomeAccessRole): boolean {
  return role !== "viewer";
}

export function canManageHomeMembership(role: HomeAccessRole): boolean {
  return role === "owner" || role === "admin";
}

export function canCreateHomeShareCode(role: HomeAccessRole): boolean {
  return canManageHomeMembership(role);
}

export function canAssignHomeRole(
  actorRole: HomeAccessRole,
  targetRole: HomeAccessRole
): boolean {
  if (targetRole === "owner") {
    return false;
  }

  if (actorRole === "owner") {
    return true;
  }

  return actorRole === "admin" && (targetRole === "member" || targetRole === "viewer");
}

export function canRevokeHomeMember(
  actorRole: HomeAccessRole,
  targetRole: HomeAccessRole,
  isSelf: boolean
): boolean {
  if (isSelf || targetRole === "owner") {
    return false;
  }

  if (actorRole === "owner") {
    return true;
  }

  return actorRole === "admin" && (targetRole === "member" || targetRole === "viewer");
}

export function findHomeMember(
  members: HomeMemberRecord[],
  userId: string
): HomeMemberRecord | undefined {
  return members.find((member) => member.userId === userId);
}
