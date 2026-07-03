import type { Request, Response } from "express";

import {
  loginWithEmail,
  loginWithProvider,
  refreshAccessToken,
  signupWithEmail
} from "./auth.service";
import type {
  EmailLoginPayload,
  EmailSignupPayload,
  ProviderAuthPayload
} from "./auth.types";

function readStringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readEmailLoginPayload(body: unknown): EmailLoginPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const email = readStringField((body as Record<string, unknown>).email);
  const password = readStringField((body as Record<string, unknown>).password);

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

function readEmailSignupPayload(body: unknown): EmailSignupPayload | null {
  const loginPayload = readEmailLoginPayload(body);
  const name = body && typeof body === "object"
    ? readStringField((body as Record<string, unknown>).name)
    : "";

  if (!loginPayload || !name) {
    return null;
  }

  return {
    ...loginPayload,
    name
  };
}

function readProviderPayload(body: unknown): ProviderAuthPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const token = readStringField((body as Record<string, unknown>).token);
  return token ? { token } : null;
}

export async function emailSignupController(request: Request, response: Response) {
  const payload = readEmailSignupPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid email signup payload" });
    return;
  }

  response.status(201).json({
    data: await signupWithEmail(payload)
  });
}

export async function emailLoginController(request: Request, response: Response) {
  const payload = readEmailLoginPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid email login payload" });
    return;
  }

  response.status(200).json({
    data: await loginWithEmail(payload)
  });
}

export async function googleLoginController(request: Request, response: Response) {
  const payload = readProviderPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid Google login payload" });
    return;
  }

  response.status(200).json({
    data: await loginWithProvider(payload, "google")
  });
}

export async function facebookLoginController(request: Request, response: Response) {
  const payload = readProviderPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid Facebook login payload" });
    return;
  }

  response.status(200).json({
    data: await loginWithProvider(payload, "facebook")
  });
}

export function refreshTokenController(request: Request, response: Response) {
  const refreshToken =
    request.body && typeof request.body === "object"
      ? readStringField((request.body as Record<string, unknown>).refreshToken)
      : "";

  if (!refreshToken) {
    response.status(400).json({ error: "Invalid refresh token payload" });
    return;
  }

  response.status(200).json({
    data: refreshAccessToken(refreshToken)
  });
}

export function logoutController(_request: Request, response: Response) {
  response.status(204).send();
}
