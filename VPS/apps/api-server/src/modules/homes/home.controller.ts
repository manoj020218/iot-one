import type { Request, Response } from "express";

import { requireAuthenticatedRequestUser } from "../../infrastructure/http/request-auth";
import {
  createHomeShareCode,
  getHomeUiBootstrap,
  listHomeMembers,
  listHomes,
  listHomeShareCodes,
  redeemHomeShareCode,
  revokeHomeMember,
  updateHomeMemberRole
} from "./home.service";
import { HomeModuleError } from "./home.types";
import {
  parseCreateHomeShareCodePayload,
  parseRedeemHomeShareCodePayload,
  parseUpdateHomeMemberRolePayload
} from "./home.validation";

function readContext(request: Request) {
  const user = requireAuthenticatedRequestUser(request);

  return {
    userId: user.userId,
    userName: user.name,
    userEmail: user.email
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof HomeModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal HOME module error"
  });
}

export function listHomesController(request: Request, response: Response) {
  listHomes(readContext(request))
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function listHomeMembersController(request: Request, response: Response) {
  listHomeMembers(request.params.homeId ?? "", readContext(request))
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function getHomeUiBootstrapController(request: Request, response: Response) {
  getHomeUiBootstrap(request.params.homeId ?? "", readContext(request))
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function listHomeShareCodesController(request: Request, response: Response) {
  listHomeShareCodes(request.params.homeId ?? "", readContext(request))
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function createHomeShareCodeController(request: Request, response: Response) {
  const payload = parseCreateHomeShareCodePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid HOME share code payload"
    });
    return;
  }

  createHomeShareCode(request.params.homeId ?? "", payload, readContext(request))
    .then((data) => {
      response.status(201).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function redeemHomeShareCodeController(request: Request, response: Response) {
  const payload = parseRedeemHomeShareCodePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid HOME redeem payload"
    });
    return;
  }

  redeemHomeShareCode(payload, readContext(request))
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function updateHomeMemberRoleController(request: Request, response: Response) {
  const payload = parseUpdateHomeMemberRolePayload(request.body);

  if (!payload) {
    response.status(400).json({
      error: "Invalid HOME role payload"
    });
    return;
  }

  updateHomeMemberRole(
    request.params.homeId ?? "",
    request.params.userId ?? "",
    payload,
    readContext(request)
  )
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}

export function revokeHomeMemberController(request: Request, response: Response) {
  revokeHomeMember(
    request.params.homeId ?? "",
    request.params.userId ?? "",
    readContext(request)
  )
    .then((data) => {
      response.status(200).json({ data });
    })
    .catch((error) => {
      sendError(response, error);
    });
}
