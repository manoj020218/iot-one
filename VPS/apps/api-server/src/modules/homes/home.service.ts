import {
  createUiPackageKey,
  canAssignHomeRole,
  canCreateHomeShareCode,
  canManageHomeMembership,
  canRevokeHomeMember,
  createAuditStamp,
  createHomeSummaryCard,
  createDefaultHome,
  defaultHomeTimezone,
  formatHomeClock,
  isHomeAccessAllowed,
  type HomeUiBootstrapDeviceBinding,
  type HomeUiBootstrapPidBinding,
  type HomeUiBootstrapResponse,
  type HomeAccessRole,
  type HomeDashboardCard,
  type HomeMemberRecord,
  type HomeRecord,
  type HomeShareCodeRecord,
  withDefaultHomeTimezone
} from "@jenix/shared";

import { deviceRepository } from "../devices/device.model";
import { sceneRepository } from "../scenes/scene.model";
import {
  homeAuditRepository,
  homeMemberRepository,
  homeRepository,
  homeShareCodeRepository,
  homeUserProfileRepository
} from "./home.model";
import type {
  CreateHomePayload,
  CreateHomeShareCodePayload,
  HomeDashboardResult,
  HomeAuditEntry,
  HomeRedeemResponse,
  HomeRequestContext,
  HomeUserProfile,
  RedeemHomeShareCodePayload,
  StoredHomeRecord,
  UpdateHomePayload,
  UpdateHomeMemberAccessPayload,
  UpdateHomeMemberRolePayload
} from "./home.types";
import { HomeModuleError } from "./home.types";
import { getPid } from "../pid/pid.service";
import { resolveUiPackageArtifact } from "../ui-packages/ui-package.catalog";

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

function createHomeId(ownerUserId: string, name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `home-${ownerUserId}-${slug || "space"}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function requireUserId(context: HomeRequestContext): string {
  if (!context.userId) {
    throw new HomeModuleError(400, "HOME actions require an authenticated user");
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
  context: Pick<HomeRequestContext, "userName" | "userEmail">
): { userId: string; name?: string; email?: string } {
  return {
    userId,
    ...(context.userName ? { name: context.userName } : {}),
    ...(context.userEmail ? { email: context.userEmail } : {})
  };
}

function mapHomeForRole(
  home: StoredHomeRecord,
  role: HomeAccessRole,
  allowed = true
): HomeRecord {
  return {
    ...home,
    role,
    allowed
  };
}

function compareHomeRecords(left: HomeRecord, right: HomeRecord): number {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  if (isHomeAccessAllowed(left) !== isHomeAccessAllowed(right)) {
    return isHomeAccessAllowed(left) ? -1 : 1;
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

  if (isHomeAccessAllowed(left) !== isHomeAccessAllowed(right)) {
    return isHomeAccessAllowed(left) ? -1 : 1;
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

async function findStoredDefaultHome(
  ownerUserId: string
): Promise<StoredHomeRecord | undefined> {
  return homeRepository.findDefaultByOwner(ownerUserId);
}

async function writeAudit(
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

  await homeAuditRepository.append(entry);
}

async function upsertUserProfile(input: {
  userId: string;
  name?: string;
  email?: string;
}): Promise<HomeUserProfile> {
  const existing = await homeUserProfileRepository.get(input.userId);
  const fallback = createFallbackUserProfile(input.userId);

  return homeUserProfileRepository.save({
    userId: input.userId,
    name: input.name?.trim() || existing?.name || fallback.name,
    email: input.email?.trim().toLowerCase() || existing?.email || fallback.email,
    updatedAt: new Date().toISOString()
  });
}

async function ensureDefaultHomeAccess(
  profile: HomeUserProfile
): Promise<StoredHomeRecord> {
  const existingDefaultHome = await findStoredDefaultHome(profile.userId);

  if (existingDefaultHome) {
    if (!existingDefaultHome.timezone) {
      await homeRepository.save({
        ...existingDefaultHome,
        timezone: defaultHomeTimezone,
        updatedAt: new Date().toISOString()
      });
    }

    if (!(await homeMemberRepository.find(existingDefaultHome.homeId, profile.userId))) {
      const timestamp = new Date().toISOString();
      await homeMemberRepository.save({
        membershipId: createMembershipId(),
        homeId: existingDefaultHome.homeId,
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        role: "owner",
        allowed: true,
        joinedAt: timestamp,
        updatedAt: timestamp
      });
    }

    return {
      ...existingDefaultHome,
      timezone: withDefaultHomeTimezone(existingDefaultHome.timezone)
    };
  }

  const defaultHome = createDefaultHome(profile.userId);
  const { role: _role, ...storedDefaultHome } = defaultHome;
  await homeRepository.save(storedDefaultHome);
  await homeMemberRepository.save({
    membershipId: createMembershipId(),
    homeId: storedDefaultHome.homeId,
    userId: profile.userId,
    name: profile.name,
    email: profile.email,
    role: "owner",
    allowed: true,
    joinedAt: storedDefaultHome.createdAt,
    updatedAt: storedDefaultHome.updatedAt
  });
  await writeAudit(storedDefaultHome.homeId, profile.userId, "home.created_default");

  return storedDefaultHome;
}

async function requireHome(homeId: string): Promise<StoredHomeRecord> {
  const home = await homeRepository.get(homeId);

  if (!home) {
    throw new HomeModuleError(404, `HOME not found: ${homeId}`);
  }

  return home;
}

async function requireMembership(
  homeId: string,
  userId: string
): Promise<HomeMemberRecord> {
  const membership = await homeMemberRepository.find(homeId, userId);

  if (!membership) {
    throw new HomeModuleError(403, "HOME access denied");
  }

  if (!isHomeAccessAllowed(membership)) {
    throw new HomeModuleError(403, "HOME access is disabled for this member");
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

function requireHomeOwner(membership: HomeMemberRecord) {
  if (membership.role !== "owner") {
    throw new HomeModuleError(403, "Only the HOME owner can perform this action");
  }
}

async function getShareCodes(homeId: string): Promise<HomeShareCodeRecord[]> {
  return (await homeShareCodeRepository.listByHome(homeId)).sort(compareShareCodes);
}

function normalizeShareCodeExpiresInHours(expiresInHours = 24): number {
  return Math.min(Math.max(Math.trunc(expiresInHours), 1), 24 * 14);
}

async function listHomesForUserId(userId: string): Promise<HomeRecord[]> {
  const profile = await upsertUserProfile({ userId });
  await ensureDefaultHomeAccess(profile);

  const memberships = await homeMemberRepository.listByUser(userId);
  const homes = await Promise.all(
    memberships.map(async (membership) => {
      const home = await requireHome(membership.homeId);
      return mapHomeForRole(home, membership.role, isHomeAccessAllowed(membership));
    })
  );

  return homes.sort(compareHomeRecords);
}

function mapPidBinding(input: {
  pid: string;
  productName: string;
  dashboard: {
    templateId: string;
    dynamicPages: string[];
    icon?: string;
    cardLayout?: string;
  };
  ui: {
    uiMode: "builtin" | "remote-package";
    uiPackageId?: string;
    uiPackageVersion?: string;
  };
}): HomeUiBootstrapPidBinding {
  const packageKey =
    input.ui.uiPackageId && input.ui.uiPackageVersion
      ? createUiPackageKey(input.ui.uiPackageId, input.ui.uiPackageVersion)
      : undefined;

  return {
    pid: input.pid,
    productName: input.productName,
    templateId: input.dashboard.templateId,
    dynamicPages: [...input.dashboard.dynamicPages],
    uiMode: input.ui.uiMode,
    ...optionalProp("icon", input.dashboard.icon),
    ...optionalProp("cardLayout", input.dashboard.cardLayout),
    ...optionalProp("uiPackageId", input.ui.uiPackageId),
    ...optionalProp("uiPackageVersion", input.ui.uiPackageVersion),
    ...optionalProp("packageKey", packageKey)
  };
}

function mapDeviceBinding(input: {
  deviceId: string;
  pid: string;
  homeId: string;
  displayName: string;
  mqttStatus: "online" | "offline" | "unknown";
  cloudStatus: "online" | "offline" | "unknown";
  pidBinding: HomeUiBootstrapPidBinding;
}): HomeUiBootstrapDeviceBinding {
  return {
    deviceId: input.deviceId,
    pid: input.pid,
    displayName: input.displayName,
    homeId: input.homeId,
    online: input.mqttStatus === "online" || input.cloudStatus === "online",
    templateId: input.pidBinding.templateId,
    dynamicPages: [...input.pidBinding.dynamicPages],
    uiMode: input.pidBinding.uiMode,
    ...optionalProp("uiPackageId", input.pidBinding.uiPackageId),
    ...optionalProp("uiPackageVersion", input.pidBinding.uiPackageVersion),
    ...optionalProp("packageKey", input.pidBinding.packageKey)
  };
}

export async function syncUserHomes(input: {
  userId: string;
  name?: string;
  email?: string;
}): Promise<HomeRecord[]> {
  const profile = await upsertUserProfile(input);
  await ensureDefaultHomeAccess(profile);
  return listHomesForUserId(profile.userId);
}

export async function resolveHomeAccessContext<
  T extends {
    userId?: string;
    homeId?: string;
    userName?: string;
    userEmail?: string;
  }
>(context: T): Promise<T & { homeRole?: HomeAccessRole }> {
  if (!context.userId || !context.homeId) {
    return context;
  }

  await syncUserHomes(createProfileSeed(context.userId, context));
  const membership = await homeMemberRepository.find(context.homeId, context.userId);

  if (!membership) {
    throw new HomeModuleError(403, "HOME access denied");
  }

  return {
    ...context,
    homeRole: membership.role
  };
}

export async function listHomes(context: HomeRequestContext): Promise<HomeRecord[]> {
  return syncUserHomes(createProfileSeed(requireUserId(context), context));
}

export async function createHome(
  payload: CreateHomePayload,
  context: HomeRequestContext
): Promise<HomeRecord> {
  const userId = requireUserId(context);
  const profile = await upsertUserProfile(createProfileSeed(userId, context));
  await ensureDefaultHomeAccess(profile);

  const now = new Date().toISOString();
  const record: StoredHomeRecord = {
    homeId: createHomeId(userId, payload.name),
    name: payload.name.trim(),
    ownerUserId: userId,
    isDefault: false,
    timezone: withDefaultHomeTimezone(payload.timezone),
    ...optionalProp("locationLabel", payload.locationLabel?.trim() || undefined),
    ...optionalProp("latitude", payload.latitude),
    ...optionalProp("longitude", payload.longitude),
    createdAt: now,
    updatedAt: now
  };

  await homeRepository.save(record);
  await homeMemberRepository.save({
    membershipId: createMembershipId(),
    homeId: record.homeId,
    userId,
    name: profile.name,
    email: profile.email,
    role: "owner",
    allowed: true,
    joinedAt: now,
    updatedAt: now
  });
  await writeAudit(record.homeId, userId, "home.created", {
    timezone: record.timezone
  });

  return mapHomeForRole(record, "owner", true);
}

export async function updateHome(
  homeId: string,
  payload: UpdateHomePayload,
  context: HomeRequestContext
): Promise<HomeRecord> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = await requireMembership(homeId, userId);
  requireMembershipManager(actorMembership);

  const existing = await requireHome(homeId);
  const updated: StoredHomeRecord = {
    ...existing,
    name: payload.name.trim(),
    timezone: withDefaultHomeTimezone(payload.timezone),
    ...optionalProp("locationLabel", payload.locationLabel?.trim() || undefined),
    ...optionalProp("latitude", payload.latitude),
    ...optionalProp("longitude", payload.longitude),
    updatedAt: new Date().toISOString()
  };

  await homeRepository.save(updated);
  await writeAudit(homeId, userId, "home.updated", {
    timezone: updated.timezone
  });

  return mapHomeForRole(updated, actorMembership.role, true);
}

export async function deleteHome(
  homeId: string,
  context: HomeRequestContext
): Promise<HomeRecord[]> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = await requireMembership(homeId, userId);
  requireHomeOwner(actorMembership);

  const home = await requireHome(homeId);
  if (home.isDefault) {
    throw new HomeModuleError(409, "The default HOME cannot be deleted");
  }

  const devices = (await deviceRepository.list()).filter((device) => device.homeId === homeId);
  if (devices.length > 0) {
    throw new HomeModuleError(409, "Remove all devices from this HOME before deleting it");
  }

  const scenes = (await sceneRepository.list()).filter((scene) => scene.homeId === homeId);
  if (scenes.length > 0) {
    throw new HomeModuleError(409, "Remove all scenes from this HOME before deleting it");
  }

  await homeShareCodeRepository.removeByHome(homeId);
  await homeMemberRepository.removeByHome(homeId);
  await homeAuditRepository.removeByHome(homeId);
  await homeRepository.remove(homeId);

  return listHomesForUserId(userId);
}

export async function getHomeDashboard(
  homeId: string,
  context: HomeRequestContext
): Promise<HomeDashboardResult> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  await requireMembership(homeId, userId);
  const home = await requireHome(homeId);
  const timezone = withDefaultHomeTimezone(home.timezone);
  const devices = (await deviceRepository.list()).filter((device) => device.homeId === homeId);
  const onlineCount = devices.filter(
    (device) => device.mqttStatus === "online" || device.cloudStatus === "online"
  ).length;
  const alertCount = devices.filter(
    (device) => device.mqttStatus !== "online" && device.cloudStatus !== "online"
  ).length;
  const activeSceneCount = (await sceneRepository.list()).filter(
    (scene) => scene.homeId === homeId && scene.status === "active"
  ).length;
  const localTime = formatHomeClock(new Date(), timezone);
  const cards: HomeDashboardCard[] = [
    createHomeSummaryCard({
      homeId,
      homeName: home.name,
      deviceCount: devices.length,
      alertCount,
      activeSceneCount,
      localTime
    })
  ];

  return {
    homeId,
    homeName: home.name,
    timezone,
    localTime,
    deviceCount: devices.length,
    onlineCount,
    alertCount,
    activeSceneCount,
    cards,
    generatedAt: new Date().toISOString()
  };
}

export async function getHomeUiBootstrap(
  homeId: string,
  context: HomeRequestContext
): Promise<HomeUiBootstrapResponse> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  await requireMembership(homeId, userId);

  const devices = (await deviceRepository.list())
    .filter((device) => device.homeId === homeId)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const uniquePids = [...new Set(devices.map((device) => device.pid))];
  const pidEntries = await Promise.all(
    uniquePids.map(async (pid) => [pid, mapPidBinding(await getPid(pid))] as const)
  );
  const pidBindingMap = new Map(pidEntries);
  const packageMap = new Map<string, ReturnType<typeof resolveUiPackageArtifact>>();

  for (const binding of pidBindingMap.values()) {
    if (!binding.uiPackageId || !binding.uiPackageVersion) {
      continue;
    }

    const artifact = resolveUiPackageArtifact(
      binding.uiPackageId,
      binding.uiPackageVersion
    );
    if (artifact) {
      packageMap.set(binding.packageKey!, artifact);
    }
  }

  return {
    homeId,
    generatedAt: new Date().toISOString(),
    devices: devices.map((device) =>
      mapDeviceBinding({
        ...device,
        pidBinding: pidBindingMap.get(device.pid)!
      })
    ),
    pidBindings: Array.from(pidBindingMap.values()).sort((left, right) =>
      left.pid.localeCompare(right.pid)
    ),
    packages: Array.from(packageMap.values()).filter(
      (item): item is NonNullable<typeof item> => Boolean(item)
    )
  };
}

export async function listHomeMembers(
  homeId: string,
  context: HomeRequestContext
): Promise<HomeMemberRecord[]> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  await requireMembership(homeId, userId);

  return (await homeMemberRepository.listByHome(homeId)).sort(compareHomeMembers);
}

export async function listHomeShareCodes(
  homeId: string,
  context: HomeRequestContext
): Promise<HomeShareCodeRecord[]> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  requireShareCodeManager(await requireMembership(homeId, userId));

  return getShareCodes(homeId);
}

export async function createHomeShareCode(
  homeId: string,
  payload: CreateHomeShareCodePayload,
  context: HomeRequestContext
): Promise<HomeShareCodeRecord> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  const membership = await requireMembership(homeId, userId);

  requireShareCodeManager(membership);

  if (!canAssignHomeRole(membership.role, payload.role)) {
    throw new HomeModuleError(
      403,
      `Role ${membership.role} cannot grant ${payload.role} HOME access`
    );
  }

  await requireHome(homeId);

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

  await homeShareCodeRepository.save(shareCode);
  await writeAudit(homeId, userId, "home.share_code.created", {
    role: shareCode.role,
    expiresAt: shareCode.expiresAt
  });

  return shareCode;
}

export async function redeemHomeShareCode(
  payload: RedeemHomeShareCodePayload,
  context: HomeRequestContext
): Promise<HomeRedeemResponse> {
  const userId = requireUserId(context);
  const profile = await upsertUserProfile(createProfileSeed(userId, context));
  await ensureDefaultHomeAccess(profile);

  const shareCode = await homeShareCodeRepository.getByCode(payload.code);

  if (!shareCode) {
    throw new HomeModuleError(404, "Share code not found");
  }

  if (shareCode.redeemedAt) {
    throw new HomeModuleError(409, "Share code has already been redeemed");
  }

  if (new Date(shareCode.expiresAt).getTime() <= Date.now()) {
    throw new HomeModuleError(410, "Share code has expired");
  }

  const home = await requireHome(shareCode.homeId);

  if (await homeMemberRepository.find(home.homeId, userId)) {
    throw new HomeModuleError(409, "User already has access to this HOME");
  }

  const now = new Date().toISOString();
  await homeMemberRepository.save({
    membershipId: createMembershipId(),
    homeId: home.homeId,
    userId,
    name: profile.name,
    email: profile.email,
    role: shareCode.role,
    allowed: true,
    joinedAt: now,
    updatedAt: now,
    invitedByUserId: shareCode.createdByUserId
  });
  await homeShareCodeRepository.save({
    ...shareCode,
    redeemedAt: now,
    redeemedByUserId: userId,
    updatedAt: now
  });
  await writeAudit(home.homeId, userId, "home.share_code.redeemed", {
    role: shareCode.role,
    code: shareCode.code
  });

  return {
    home: mapHomeForRole(home, shareCode.role, true),
    homes: await listHomesForUserId(userId)
  };
}

export async function updateHomeMemberRole(
  homeId: string,
  targetUserId: string,
  payload: UpdateHomeMemberRolePayload,
  context: HomeRequestContext
): Promise<HomeMemberRecord[]> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = await requireMembership(homeId, userId);
  const targetMembership = await requireMembership(homeId, targetUserId);

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

  await homeMemberRepository.save({
    ...targetMembership,
    role: payload.role,
    updatedAt: new Date().toISOString()
  });
  await writeAudit(homeId, userId, "home.member.role_updated", {
    targetUserId,
    role: payload.role
  });

  return listHomeMembers(homeId, context);
}

export async function updateHomeMemberAccess(
  homeId: string,
  targetUserId: string,
  payload: UpdateHomeMemberAccessPayload,
  context: HomeRequestContext
): Promise<HomeMemberRecord[]> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = await requireMembership(homeId, userId);
  const targetMembership = await homeMemberRepository.find(homeId, targetUserId);

  requireMembershipManager(actorMembership);

  if (!targetMembership) {
    throw new HomeModuleError(404, "HOME member not found");
  }

  if (
    !canRevokeHomeMember(
      actorMembership.role,
      targetMembership.role,
      targetMembership.userId === actorMembership.userId
    )
  ) {
    throw new HomeModuleError(
      403,
      `Role ${actorMembership.role} cannot update ${targetMembership.role} access`
    );
  }

  await homeMemberRepository.save({
    ...targetMembership,
    allowed: payload.allowed,
    updatedAt: new Date().toISOString()
  });
  await writeAudit(homeId, userId, "home.member.access_updated", {
    targetUserId,
    allowed: payload.allowed
  });

  return listHomeMembers(homeId, context);
}

export async function revokeHomeMember(
  homeId: string,
  targetUserId: string,
  context: HomeRequestContext
): Promise<HomeMemberRecord[]> {
  const userId = requireUserId(context);
  await syncUserHomes(createProfileSeed(userId, context));
  const actorMembership = await requireMembership(homeId, userId);
  const targetMembership = await requireMembership(homeId, targetUserId);

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

  await homeMemberRepository.remove(homeId, targetMembership.membershipId);
  await writeAudit(homeId, userId, "home.member.revoked", {
    targetUserId
  });

  return listHomeMembers(homeId, context);
}

export const homeTesting = {
  async reset() {
    await homeRepository.reset();
    await homeMemberRepository.reset();
    await homeShareCodeRepository.reset();
    await homeUserProfileRepository.reset();
    await homeAuditRepository.reset();
  }
};
