import type { Request, Response } from "express";

import {
  loginWithEmail,
  loginWithProvider,
  logout,
  refreshAccessToken,
  signupWithEmail
} from "./auth.service";
import type {
  EmailLoginPayload,
  EmailSignupPayload,
  ProviderAuthPayload
} from "./auth.types";
import { AuthModuleError } from "./auth.types";

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

function sendError(response: Response, error: unknown) {
  if (error instanceof AuthModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal auth module error"
  });
}

export async function emailSignupController(request: Request, response: Response) {
  const payload = readEmailSignupPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid email signup payload" });
    return;
  }

  try {
    response.status(201).json({
      data: await signupWithEmail(payload)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function emailLoginController(request: Request, response: Response) {
  const payload = readEmailLoginPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid email login payload" });
    return;
  }

  try {
    response.status(200).json({
      data: await loginWithEmail(payload)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function googleLoginController(request: Request, response: Response) {
  const payload = readProviderPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid Google login payload" });
    return;
  }

  try {
    response.status(200).json({
      data: await loginWithProvider(payload, "google")
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function facebookLoginController(request: Request, response: Response) {
  const payload = readProviderPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: "Invalid Facebook login payload" });
    return;
  }

  try {
    response.status(200).json({
      data: await loginWithProvider(payload, "facebook")
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function refreshTokenController(request: Request, response: Response) {
  const refreshToken =
    request.body && typeof request.body === "object"
      ? readStringField((request.body as Record<string, unknown>).refreshToken)
      : "";

  if (!refreshToken) {
    response.status(400).json({ error: "Invalid refresh token payload" });
    return;
  }

  try {
    response.status(200).json({
      data: await refreshAccessToken(refreshToken)
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function logoutController(request: Request, response: Response) {
  const refreshToken =
    request.body && typeof request.body === "object"
      ? readStringField((request.body as Record<string, unknown>).refreshToken)
      : "";

  try {
    await logout(refreshToken || undefined);
    response.status(204).send();
  } catch (error) {
    sendError(response, error);
  }
}
