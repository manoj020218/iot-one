export type HomeAccessRole = "owner" | "admin" | "member" | "viewer";

export interface HomeRecord {
  homeId: string;
  name: string;
  ownerUserId: string;
  role: HomeAccessRole;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HomeMemberRecord {
  membershipId: string;
  homeId: string;
  userId: string;
  name: string;
  email: string;
  role: HomeAccessRole;
  joinedAt: string;
  updatedAt: string;
  invitedByUserId?: string;
}

export interface HomeShareCodeRecord {
  shareCodeId: string;
  homeId: string;
  code: string;
  role: Exclude<HomeAccessRole, "owner">;
  createdByUserId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  redeemedAt?: string;
  redeemedByUserId?: string;
}
