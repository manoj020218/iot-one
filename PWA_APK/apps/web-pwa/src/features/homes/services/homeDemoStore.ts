import {
  canAssignHomeRole,
  canRevokeHomeMember,
  createDefaultHome,
  type HomeAccessRole,
  type HomeMemberRecord,
  type HomeRecord,
  type HomeShareCodeRecord
} from "@jenix/shared";

type DemoHomeBase = Omit<HomeRecord, "role">;

interface DemoUserProfile {
  userId: string;
  name: string;
  email: string;
}

const homeStore = new Map<string, DemoHomeBase>();
const homeMemberStore = new Map<string, HomeMemberRecord[]>();
const homeShareCodeStore = new Map<string, HomeShareCodeRecord[]>();
const userProfileStore = new Map<string, DemoUserProfile>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createMembershipId(): string {
  return `hm-${Math.random().toString(36).slice(2, 10)}`;
}

function createShareCodeId(): string {
  return `hsc-${Math.random().toString(36).slice(2, 10)}`;
}

function createShareCodeValue(): string {
  return `JNX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function getFallbackProfile(userId: string): DemoUserProfile {
  return {
    userId,
    name: userId.replace(/^user-/, "").replace(/-/g, " "),
    email: `${userId}@jenix.local`
  };
}

function upsertUserProfile(input: {
  userId: string;
  name?: string;
  email?: string;
}): DemoUserProfile {
  const existing = userProfileStore.get(input.userId);
  const fallback = getFallbackProfile(input.userId);
  const profile: DemoUserProfile = {
    userId: input.userId,
    name: input.name?.trim() || existing?.name || fallback.name,
    email: input.email?.trim().toLowerCase() || existing?.email || fallback.email
  };

  userProfileStore.set(profile.userId, clone(profile));
  return clone(profile);
}

function listHomeMembersInternal(homeId: string): HomeMemberRecord[] {
  return clone(homeMemberStore.get(homeId) ?? []);
}

function saveHomeMember(record: HomeMemberRecord) {
  const members = listHomeMembersInternal(record.homeId);
  const nextMembers = members.some((member) => member.membershipId === record.membershipId)
    ? members.map((member) =>
        member.membershipId === record.membershipId ? clone(record) : member
      )
    : [...members, clone(record)];

  homeMemberStore.set(record.homeId, nextMembers);
}

function ensureDefaultHome(profile: DemoUserProfile): DemoHomeBase {
  const existingDefaultHome = Array.from(homeStore.values()).find(
    (home) => home.ownerUserId === profile.userId && home.isDefault
  );

  if (existingDefaultHome) {
    if (
      !listHomeMembersInternal(existingDefaultHome.homeId).some(
        (member) => member.userId === profile.userId
      )
    ) {
      const now = new Date().toISOString();
      saveHomeMember({
        membershipId: createMembershipId(),
        homeId: existingDefaultHome.homeId,
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        role: "owner",
        joinedAt: now,
        updatedAt: now
      });
    }

    return clone(existingDefaultHome);
  }

  const defaultHome = createDefaultHome(profile.userId);
  const { role: _role, ...storedHome } = defaultHome;
  homeStore.set(storedHome.homeId, clone(storedHome));
  saveHomeMember({
    membershipId: createMembershipId(),
    homeId: storedHome.homeId,
    userId: profile.userId,
    name: profile.name,
    email: profile.email,
    role: "owner",
    joinedAt: storedHome.createdAt,
    updatedAt: storedHome.updatedAt
  });

  return clone(storedHome);
}

function requireMembership(
  homeId: string,
  userId: string
): HomeMemberRecord {
  const membership = listHomeMembersInternal(homeId).find(
    (member) => member.userId === userId
  );

  if (!membership) {
    throw new Error("HOME access denied");
  }

  return membership;
}

function mapHomeForRole(baseHome: DemoHomeBase, role: HomeAccessRole): HomeRecord {
  return {
    ...baseHome,
    role
  };
}

function listActiveShareCodes(homeId: string): HomeShareCodeRecord[] {
  return clone(homeShareCodeStore.get(homeId) ?? []).filter(
    (shareCode) =>
      !shareCode.redeemedAt &&
      new Date(shareCode.expiresAt).getTime() > Date.now()
  );
}

export function listDemoHomes(input: {
  userId: string;
  userName?: string;
  userEmail?: string;
}): HomeRecord[] {
  const profile = upsertUserProfile({
    userId: input.userId,
    ...(input.userName ? { name: input.userName } : {}),
    ...(input.userEmail ? { email: input.userEmail } : {})
  });
  ensureDefaultHome(profile);

  return Array.from(homeStore.values())
    .map((home) => {
      const membership = listHomeMembersInternal(home.homeId).find(
        (member) => member.userId === input.userId
      );

      return membership ? mapHomeForRole(home, membership.role) : null;
    })
    .filter((home): home is HomeRecord => home !== null)
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export function listDemoHomeMembers(homeId: string, userId: string): HomeMemberRecord[] {
  requireMembership(homeId, userId);
  return listHomeMembersInternal(homeId).sort((left, right) => {
    if (left.role === "owner" && right.role !== "owner") {
      return -1;
    }

    if (left.role !== "owner" && right.role === "owner") {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function listDemoHomeShareCodes(homeId: string, userId: string): HomeShareCodeRecord[] {
  const membership = requireMembership(homeId, userId);

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Only owner/admin can create or view share codes");
  }

  return listActiveShareCodes(homeId);
}

export function createDemoHomeShareCode(input: {
  homeId: string;
  userId: string;
  role: Exclude<HomeAccessRole, "owner">;
  expiresInHours?: number;
}): HomeShareCodeRecord {
  const membership = requireMembership(input.homeId, input.userId);

  if (
    (membership.role !== "owner" && membership.role !== "admin") ||
    !canAssignHomeRole(membership.role, input.role)
  ) {
    throw new Error(`Role ${membership.role} cannot create this share code`);
  }

  const now = new Date();
  const shareCode: HomeShareCodeRecord = {
    shareCodeId: createShareCodeId(),
    homeId: input.homeId,
    code: createShareCodeValue(),
    role: input.role,
    createdByUserId: input.userId,
    expiresAt: new Date(
      now.getTime() + Math.max(input.expiresInHours ?? 24, 1) * 60 * 60 * 1000
    ).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const shareCodes = clone(homeShareCodeStore.get(input.homeId) ?? []);
  homeShareCodeStore.set(input.homeId, [...shareCodes, clone(shareCode)]);
  return shareCode;
}

export function redeemDemoHomeShareCode(input: {
  userId: string;
  userName?: string;
  userEmail?: string;
  code: string;
}): { home: HomeRecord; homes: HomeRecord[] } {
  const profile = upsertUserProfile({
    userId: input.userId,
    ...(input.userName ? { name: input.userName } : {}),
    ...(input.userEmail ? { email: input.userEmail } : {})
  });
  ensureDefaultHome(profile);

  const shareCode = Array.from(homeShareCodeStore.values())
    .flatMap((shareCodes) => shareCodes)
    .find((item) => item.code === input.code.trim().toUpperCase());

  if (!shareCode) {
    throw new Error("Share code not found");
  }

  if (shareCode.redeemedAt) {
    throw new Error("Share code has already been redeemed");
  }

  if (new Date(shareCode.expiresAt).getTime() <= Date.now()) {
    throw new Error("Share code has expired");
  }

  if (listHomeMembersInternal(shareCode.homeId).some((member) => member.userId === input.userId)) {
    throw new Error("User already has access to this HOME");
  }

  const now = new Date().toISOString();
  saveHomeMember({
    membershipId: createMembershipId(),
    homeId: shareCode.homeId,
    userId: input.userId,
    name: profile.name,
    email: profile.email,
    role: shareCode.role,
    joinedAt: now,
    updatedAt: now,
    invitedByUserId: shareCode.createdByUserId
  });
  const shareCodes = clone(homeShareCodeStore.get(shareCode.homeId) ?? []).map((item) =>
    item.shareCodeId === shareCode.shareCodeId
      ? {
          ...item,
          redeemedAt: now,
          redeemedByUserId: input.userId,
          updatedAt: now
        }
      : item
  );
  homeShareCodeStore.set(shareCode.homeId, shareCodes);

  const home = homeStore.get(shareCode.homeId)!;

  return {
    home: mapHomeForRole(home, shareCode.role),
    homes: listDemoHomes({
      userId: input.userId,
      userName: profile.name,
      userEmail: profile.email
    })
  };
}

export function updateDemoHomeMemberRole(input: {
  homeId: string;
  actorUserId: string;
  targetUserId: string;
  role: Exclude<HomeAccessRole, "owner">;
}): HomeMemberRecord[] {
  const actorMembership = requireMembership(input.homeId, input.actorUserId);
  const targetMembership = requireMembership(input.homeId, input.targetUserId);

  if (
    !canRevokeHomeMember(
      actorMembership.role,
      targetMembership.role,
      actorMembership.userId === targetMembership.userId
    ) ||
    !canAssignHomeRole(actorMembership.role, input.role)
  ) {
    throw new Error(`Role ${actorMembership.role} cannot update this member`);
  }

  saveHomeMember({
    ...targetMembership,
    role: input.role,
    updatedAt: new Date().toISOString()
  });

  return listDemoHomeMembers(input.homeId, input.actorUserId);
}

export function revokeDemoHomeMember(input: {
  homeId: string;
  actorUserId: string;
  targetUserId: string;
}): HomeMemberRecord[] {
  const actorMembership = requireMembership(input.homeId, input.actorUserId);
  const targetMembership = requireMembership(input.homeId, input.targetUserId);

  if (
    !canRevokeHomeMember(
      actorMembership.role,
      targetMembership.role,
      actorMembership.userId === targetMembership.userId
    )
  ) {
    throw new Error(`Role ${actorMembership.role} cannot revoke this member`);
  }

  const nextMembers = listHomeMembersInternal(input.homeId).filter(
    (member) => member.membershipId !== targetMembership.membershipId
  );
  homeMemberStore.set(input.homeId, nextMembers);

  return listDemoHomeMembers(input.homeId, input.actorUserId);
}

export const homeDemoStoreTesting = {
  reset() {
    homeStore.clear();
    homeMemberStore.clear();
    homeShareCodeStore.clear();
    userProfileStore.clear();
  }
};
