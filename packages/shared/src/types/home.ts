export type HomeAccessRole = "owner" | "admin" | "member" | "viewer";

export interface HomeRecord {
  homeId: string;
  name: string;
  ownerUserId: string;
  role: HomeAccessRole;
  allowed?: boolean;
  isDefault: boolean;
  timezone?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
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
  allowed?: boolean;
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

export interface HomeDashboardCard {
  cardId: string;
  title: string;
  subtitle: string;
  tone: "neutral" | "info" | "success" | "warning";
  primaryValue: string;
  secondaryValue?: string;
  badge?: string;
  imageUrl?: string;
}

export interface HomeDashboardResponse {
  homeId: string;
  homeName: string;
  timezone: string;
  localTime: string;
  deviceCount: number;
  onlineCount: number;
  alertCount: number;
  activeSceneCount: number;
  cards: HomeDashboardCard[];
}
