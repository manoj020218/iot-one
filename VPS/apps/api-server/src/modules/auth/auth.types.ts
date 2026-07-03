import type { AuthProvider, AuthSession } from "@jenix/shared";

export interface EmailLoginPayload {
  email: string;
  password: string;
}

export interface EmailSignupPayload extends EmailLoginPayload {
  name: string;
}

export interface ProviderAuthPayload {
  token: string;
}

export interface AuthSessionResponse {
  data: AuthSession;
}

export interface AuthProviderSessionSeed {
  email: string;
  name: string;
  provider: AuthProvider;
}

export interface AuthenticatedRequestUser {
  userId: string;
  name: string;
  email: string;
  provider: AuthProvider;
}

export class AuthModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AuthModuleError";
  }
}
