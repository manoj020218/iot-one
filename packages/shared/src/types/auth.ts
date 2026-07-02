import type { HomeRecord } from "./home";

export type AuthProvider = "email" | "google" | "facebook";

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  provider: AuthProvider;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AuthSession {
  user: AuthenticatedUser;
  homes: HomeRecord[];
  tokens: TokenPair;
}
