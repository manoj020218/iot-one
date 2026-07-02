import {
  canAssignHomeRole,
  canCreateHomeShareCode,
  canManageHomeMembership,
  canRevokeHomeMember,
  createAuditStamp,
  createDefaultHome,
  type HomeAccessRole,
  type HomeMemberRecord,
  type HomeRecord,
  type HomeShareCodeRecord
} from "@jenix/shared";

import {
  homeAuditRepository,
  homeMemberRepository,
  homeRepository,
  homeShareCodeRepository,
  homeUserProfileRepository
} from "./home.model";
import type {
  CreateHomeShareCodePayload,
  HomeAuditEntry,
  HomeRedeemResponse,
  HomeRequestContext,
  HomeUserProfile,
  RedeemHomeShareCodePayload,
  StoredHomeRecord,
  UpdateHomeMemberRolePayload
} from "./home.types";
import { HomeModuleError } from "./home.types";

function createMembershipId(): string {
  return `hm-${Math.random().toString(36).slice(2, 10)}`;
}

function createShareCodeId(): string {
  return `hsc-${Math.random().toString(36).slice(2, 10)}`;
}

function createAuditId(): string {
  return `ha-${Math.random().toString(36).slice(2, 10)}`;
}

function createShareCodeValue(): string {
  return `JNX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function requireUserId(context: HomeRequestContext): string {
  if (!context.userId) {
    throw new HomeModuleError(400, "HOME actions require x-user-id");
  }

  return context.userId;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value
  } as Record<K, V>;
}

function createFallbackUserProfile(userId: string): HomeUserProfile {
  return {
    userId,
    name: userId.replace(/^user-/, "").replace(/-/g, " "),
    email: `${userId}@jenix.local`,
    updatedAt: new Date().toISOString()
  };
}

function createProfileSeed(
  userId: string,
  context: HomeRequestContext
): { userId: string; name?: string; email?: string } {
  return {
    userId,
    ...(context.userName ? { name: context.userName } : {}),
    ...(context.userEmail ? { email: context.userEmail } : {})
  };
}

function mapHomeForRole(
  home: StoredHomeRecord,
  role: HomeAccessRole
): HomeRecord {
  return {
    ...home,
    role
  };
}

function compareHomeRecords(left: HomeRecord, right: HomeRecord): number {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function compareHomeMembers(
  left: HomeMemberRecord,
  right: HomeMemberRecord
): number {
  if (left.role === "owner" && right.role !== "owner") {
    return -1;
  }

  if (left.role !== "owner" && right.role === "owner") {
    return 1;
  }

  return left.name.localeCompare(right.name);
}

function normalizeRoleWeight(role: HomeAccessRole): number {
  switch (role) {
    case "owner":
      return 0;
    case "admin":
      return 1;
    case "member":
      return 2;
    default:
      return 3;
  }
}

function compareShareCodes(
  left: HomeShareCodeRecord,
  right: HomeShareCodeRecord
): number {
  const roleDifference =
    normalizeRoleWeight(left.role) - normalizeRoleWeight(right.role);

  if (roleDifference !== 0) {
    return roleDifference;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

function findStoredDefaultHome(ownerUserId: string): StoredHomeRecord | undefined {
  return homeRepository
    .list()
    .find((home) => home.ownerUserId === ownerUserId && home.isDefault);
}

function writeAudit(
  homeId: string,
  actorId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  const stamp = createAuditStamp({
    actorId,
    action
  });
  const entry: HomeAuditEntry = {
    auditId: createAuditId(),
    homeId,
    actorId: stamp.actorId,
    action: stamp.action,
    occurredAt: stamp.occurredAt,
    ...optionalProp("metadata", metadata)
  };

  homeAuditRepository.append(entry);
}

function upsertUserProfile(input: {
  userId: string;
  name?: string;
  email?: string;
}): HomeUserProfile {
  const existing = homeUserProfileRepository.get(input.userId);
  const fallback = createFallbackUserProfile(input.userId);

  return homeUserProfileRepository.save({
    userId: input.userId,
    name: input.name?.trim() || existing?.name || fallback.name,
    email: input.email?.trim().toLowerCase() || existing?.email || fallback.email,
    updatedAt: new Date().toISOString()
  });
}

function ensureDefaultHomeAccess(profile: HomeUserProfile): StoredHomeRecord {
  const existingDefaultHome = findStoredDefaultHome(profile.userId);

  if (existingDefaultHome) {
    if (!homeMemberRepository.find(existingDefaultHome.homeId, profile.userId)) {
      const timestamp = new Date().toISOString();
      homeMemberRepository.save({
        membershipId: createMembershipId(),
        homeId: existingDefaultHome.homeId,
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        role: "owner",
        joinedAt: timestamp,
        updatedAt: timestamp
      });
    }

    return existingDefaultHome;
  }

  const defaultHome = createDefaultHome(profile.userId);
  const { role: _role, ...storedDefaultHome } = defaultHome;
  homeRepository.save(storedDefaultHome);
  homeMemberRepository.save({
    membershipId: createMembershipId(),
    homeId: storedDefaultHome.homeId,
    userId: profile.userId,
    name: profile.name,
    email: profile.email,
    role: "owner",
    joinedAt: storedDefaultHome.createdAt,
    updatedAt: storedDefaultHome.updatedAt
  });
  writeAudit(storedDefaultHome.homeId, profile.userId, "home.created_default");

  return storedDefaultHome;
}

function requireHome(homeId: string): StoredHomeRecord {
  const home = homeRepository.get(homeId);

  if (!home) {
    throw new HomeModuleError(404, `HOME not found: ${homeId}`);
  }

  return home;
}

function requireMembership(
  homeId: string,
  userId: string
): HomeMemberRecord {
  const membership = homeMemberRepository.find(homeId, userId);

  if (!membership) {
    throw new HomeModuleError(403, "HOME access denied");
  }

  return membership;
}

function requireShareCodeManager(membership: HomeMemberRecord) {
  if (!canCreateHomeShareCode(membership.role)) {
    throw new HomeModuleError(403, "Only owner/admin can create or view share codes");
  }
}

function requireMembershipManager(membership: HomeMemberRecord) {
  if (!canManageHomeMembership(membership.role)) {
    throw new HomeModuleError(403, "Only owner/admin can manage HOME members");
  }
}

function getActiveShareCodes(homeId: string): HomeShareCodeRecord[] {
  const now = new Date();

  return homeShareCodeRepository
    .listByHome(homeId)
    .filter(
      (shareCode) =>
        !shareCode.redeemedAt && new Date(shareCode.expiresAt).getTime() > now.getTime()
    )
    .sort(compareShareCodes);
}

function normalizeShareCodeExpiresInHours(expiresInHours = 24): number {
  return Math.min(Math.max(Math.trunc(expiresInHours), 1), 24 * 14);
}

function listHomesForUserId(userId: string): HomeRecord[] {
  const profile = upsertUserProfile({ userId });
  ensureDefaultHomeAccess(profile);

  return homeMemberRepository
    .listByUser(userId)
    .map((membership) => {
      const home = requireHome(membership.homeId);
      return mapHomeForRole(home, membership.role);
    })
    .sort(compareHomeRecords);
}

export function syncUserHomes(input: {
  userId: string;
  name?: string;
  email?: string;
}): HomeRecord[] {
  const profile = upsertUserProfile(input);
  ensureDefaultHomeAccess(profile);
  return listHomesForUserId(profile.userId);
}

export function listHomes(context: HomeRequestContext): HomeRecord[] {
  return syncUserHomes(createProfileSeed(requireUserId(context), context));
}

export function listHomeMembers(
  homeId: string,
  context: HomeRequestContext
): HomeMemberRecord[] {
  const userId = requireUserId(context);
  syncUserHomes(createProfileSeed(userId, context));
  requireMembership(homeId, userId);

  return homeMemberRepository.listByHome(homeId).sort(compareHomeMembers);
}

export function listHomeShareCodes(
  homeId: string,
  context: HomeRequestContext
): HomeShareCodeRecord[] {
  const userId = requireUserId(context);
  syncUserHomes(createProfileSeed(userId, context));
  requireShareCodeManager(requireMembership(homeId, userId));

  return getActiveShareCodes(homeId);
}

export function createHomeShareCode(
  homeId: string,
  payload: CreateHomeShareCodePayload,
  context: HomeRequestContext
): HomeShareCodeRecord {
  const userId = requireUserId(context);
  syncUserHomes(createProfileSeed(userId, context));
  const membership = requireMembership(homeId, userId);

  requireShareCodeManager(membership);

  if (!canAssignHomeRole(membership.role, payload.role)) {
    throw new HomeModuleError(
      403,
      `Role ${membership.role} cannot grant ${payload.role} HOME access`
    );
  }

  requireHome(homeId);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + normalizeShareCodeExpiresInHours(payload.expiresInHours) * 60 * 60 * 1000
  );
  const shareCode: HomeShareCodeRecord = {
    shareCodeId: createShareCodeId(),
    homeId,
    code: createShareCodeValue(),
    role: payload.role,
    createdByUserId: userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  homeShareCodeRepository.save(shareCode);
  writeAudit(homeId, userId, "home.share_code.created", {
    role: shareCode.role,
    expiresAt: shareCode.expiresAt
  });

  return shareCode;
}

export function redeemHomeShareCode(
  payload: RedeemHomeShareCodePayload,
  context: HomeRequestContext
): HomeRedeemResponse {
  const userId = requireUserId(context);
  const profile = upsertUserProfile(createProfileSeed(userId, context));
  ensureDefaultHomeAccess(profile);

  const shareCode = homeShareCodeRepository.getByCode(payload.code);

  if (!shareCode) {
    throw new HomeModuleError(404, "Share code not found");
  }

  if (shareCode.redeemedAt) {
    throw new HomeModuleError(409, "Share code has already been redeemed");
  }

  if (new Date(shareCode.expiresAt).getTime() <= Date.now()) {
    throw new HomeModuleError(410, "Share code has expired");
  }

  const home = requireHome(shareCode.homeId);

  if (homeMemberRepository.find(home.homeId, userId)) {
    throw new HomeModuleError(409, "User already has access to this HOME");
  }

  const now = new Date().toISOString();
  homeMemberRepository.save({
    membershipId: createMembershipId(),
    homeId: home.homeId,
    userId,
    name: profile.name,
    email: profile.email,
    role: shareCode.role,
    joinedAt: now,
    updatedAt: now,
    invitedByUserId: shareCode.createdByUserId
  });
  homeShareCodeRepository.save({
    ...shareCode,
    redeemedAt: now,
    redeemedByUserId: userId,
    updatedAt: now
  });
  writeAudit(home.homeId, userId, "home.share_code.redeemed", {
    role: shareCode.role,
    code: shareCode.code
  });

  return {
    home: mapHomeForRole(home, shareCode.role),
    homes: listHomesForUserId(userId)
  };
}

export function updateHomeMemberRole(
  homeId: string,
  targetUserId: string,
  payload: UpdateHomeMemberRolePayload,
  context: HomeRequestContext
): HomeMemberRecord[] {
  const userId = requireUserId(context);
  syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = requireMembership(homeId, userId);
  const targetMembership = requireMembership(homeId, targetUserId);

  requireMembershipManager(actorMembership);

  if (
    !canRevokeHomeMember(
      actorMembership.role,
      targetMembership.role,
      targetMembership.userId === actorMembership.userId
    ) ||
    !canAssignHomeRole(actorMembership.role, payload.role)
  ) {
    throw new HomeModuleError(
      403,
      `Role ${actorMembership.role} cannot update ${targetMembership.role} access`
    );
  }

  homeMemberRepository.save({
    ...targetMembership,
    role: payload.role,
    updatedAt: new Date().toISOString()
  });
  writeAudit(homeId, userId, "home.member.role_updated", {
    targetUserId,
    role: payload.role
  });

  return listHomeMembers(homeId, context);
}

export function revokeHomeMember(
  homeId: string,
  targetUserId: string,
  context: HomeRequestContext
): HomeMemberRecord[] {
  const userId = requireUserId(context);
  syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = requireMembership(homeId, userId);
  const targetMembership = requireMembership(homeId, targetUserId);

  requireMembershipManager(actorMembership);

  if (
    !canRevokeHomeMember(
      actorMembership.role,
      targetMembership.role,
      targetMembership.userId === actorMembership.userId
    )
  ) {
    throw new HomeModuleError(
      403,
      `Role ${actorMembership.role} cannot revoke ${targetMembership.role} access`
    );
  }

  homeMemberRepository.remove(homeId, targetMembership.membershipId);
  writeAudit(homeId, userId, "home.member.revoked", {
    targetUserId
  });

  return listHomeMembers(homeId, context);
}

export const homeTesting = {
  reset() {
    homeRepository.reset();
    homeMemberRepository.reset();
    homeShareCodeRepository.reset();
    homeUserProfileRepository.reset();
    homeAuditRepository.reset();
  }
};
