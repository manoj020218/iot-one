import type { Request, Response } from "express";

import {
  readHomeIdFromRequest,
  requireAuthenticatedRequestUser
} from "../../infrastructure/http/request-auth";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "./notification.service";
import { NotificationModuleError } from "./notification.types";
import type { NotificationRequestContext } from "./notification.types";

function readContext(request: Request): NotificationRequestContext {
  const user = requireAuthenticatedRequestUser(request);
  const homeId = readHomeIdFromRequest(request);

  return {
    userId: user.userId,
    ...(homeId ? { homeId } : {})
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof NotificationModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal notification module error"
  });
}

export async function listNotificationsController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await listNotifications(readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function markNotificationReadController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await markNotificationRead(request.params.notificationId ?? "", readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function markAllNotificationsReadController(
  request: Request,
  response: Response
) {
  try {
    response.status(200).json({
      data: await markAllNotificationsRead(readContext(request))
    });
  } catch (error) {
    sendError(response, error);
  }
}

export async function deleteNotificationController(request: Request, response: Response) {
  try {
    await deleteNotification(request.params.notificationId ?? "", readContext(request));
    response.status(200).json({
      data: { notificationId: request.params.notificationId }
    });
  } catch (error) {
    sendError(response, error);
  }
}
