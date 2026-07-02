import type { AuthProvider } from "@jenix/shared";

export interface AuthUserRecord {
  userId: string;
  name: string;
  email: string;
  provider: AuthProvider;
}
