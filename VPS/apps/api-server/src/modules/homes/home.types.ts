import type {
  HomeAccessRole,
  HomeDashboardResponse,
  HomeRecord
} from "@jenix/shared";

export interface HomeRequestContext {
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export interface HomeUserProfile {
  userId: string;
  name: string;
  email: string;
  updatedAt: string;
}

export type StoredHomeRecord = Omit<HomeRecord, "role">;

export interface CreateHomeShareCodePayload {
  role: Exclude<HomeAccessRole, "owner">;
  expiresInHours?: number;
}

export interface CreateHomePayload {
  name: string;
  timezone?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
}

export interface RedeemHomeShareCodePayload {
  code: string;
}

export interface UpdateHomePayload extends CreateHomePayload {}

export interface UpdateHomeMemberRolePayload {
  role: Exclude<HomeAccessRole, "owner">;
}

export interface UpdateHomeMemberAccessPayload {
  allowed: boolean;
}

export interface HomeRedeemResponse {
  home: HomeRecord;
  homes: HomeRecord[];
}

export interface HomeDashboardResult extends HomeDashboardResponse {
  generatedAt: string;
}

export interface HomeAuditEntry {
  auditId: string;
  homeId: string;
  actorId: string;
  action: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export class HomeModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HomeModuleError";
  }
}
