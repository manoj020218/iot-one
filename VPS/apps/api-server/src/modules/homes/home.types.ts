import type {
  HomeAccessRole,
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

export interface RedeemHomeShareCodePayload {
  code: string;
}

export interface UpdateHomeMemberRolePayload {
  role: Exclude<HomeAccessRole, "owner">;
}

export interface HomeRedeemResponse {
  home: HomeRecord;
  homes: HomeRecord[];
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
