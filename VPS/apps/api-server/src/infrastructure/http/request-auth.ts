import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../../modules/auth/auth.token";
import type { AuthenticatedRequestUser } from "../../modules/auth/auth.types";

function readAuthorizationHeader(request: Request): string | undefined {
  const value = request.header("authorization");
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sendUnauthorized(response: Response, message: string) {
  response.status(401).json({
    error: message
  });
}

export function requireAuthenticatedUser(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const authorization = readAuthorizationHeader(request);

  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    sendUnauthorized(response, "Authorization bearer token is required");
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    const claims = verifyAccessToken(token);
    const authenticatedUser: AuthenticatedRequestUser = {
      userId: claims.sub,
      name: claims.name,
      email: claims.email,
      provider: claims.provider
    };

    request.authenticatedUser = authenticatedUser;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid access token";
    sendUnauthorized(response, message);
  }
}

export function requireAuthenticatedRequestUser(
  request: Request
): AuthenticatedRequestUser {
  if (!request.authenticatedUser) {
    throw new Error("Authenticated user is not attached to the request");
  }

  return request.authenticatedUser;
}

export function readHomeIdFromRequest(request: Request): string | undefined {
  const value = request.header("x-home-id");
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
