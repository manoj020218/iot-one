import type { NotificationRecord } from "@jenix/shared";

import { resolveHomeAccessContext } from "../homes/home.service";
import { HomeModuleError } from "../homes/home.types";
import { notificationRepository } from "./notification.model";
import { NotificationModuleError, type NotificationRequestContext } from "./notification.types";

async function resolveContext(
  context: NotificationRequestContext
): Promise<NotificationRequestContext> {
  try {
    return await resolveHomeAccessContext(context);
  } catch (error) {
    if (error instanceof HomeModuleError) {
      throw new NotificationModuleError(error.statusCode, error.message);
    }

    throw error;
  }
}

function requireHomeId(context: NotificationRequestContext): string {
  if (!context.homeId) {
    throw new NotificationModuleError(400, "Notification actions require x-home-id");
  }

  return context.homeId;
}

async function requireNotification(notificationId: string): Promise<NotificationRecord> {
  const notification = await notificationRepository.get(notificationId);

  if (!notification) {
    throw new NotificationModuleError(404, `Notification not found: ${notificationId}`);
  }

  return notification;
}

function assertHomeMatch(notification: NotificationRecord, homeId: string): NotificationRecord {
  if (notification.homeId !== homeId) {
    throw new NotificationModuleError(403, "Notification access denied for this HOME");
  }

  return notification;
}

export async function listNotifications(
  context: NotificationRequestContext
): Promise<NotificationRecord[]> {
  const resolvedContext = await resolveContext(context);
  const homeId = requireHomeId(resolvedContext);

  return notificationRepository.listByHome(homeId);
}

export async function markNotificationRead(
  notificationId: string,
  context: NotificationRequestContext
): Promise<NotificationRecord> {
  const resolvedContext = await resolveContext(context);
  const homeId = requireHomeId(resolvedContext);
  const existing = assertHomeMatch(await requireNotification(notificationId), homeId);

  if (existing.readAt) {
    return existing;
  }

  return notificationRepository.save({
    ...existing,
    readAt: new Date().toISOString()
  });
}

export async function markAllNotificationsRead(
  context: NotificationRequestContext
): Promise<NotificationRecord[]> {
  const resolvedContext = await resolveContext(context);
  const homeId = requireHomeId(resolvedContext);
  const notifications = await notificationRepository.listByHome(homeId);
  const readAt = new Date().toISOString();

  await Promise.all(
    notifications
      .filter((notification) => !notification.readAt)
      .map((notification) => notificationRepository.save({ ...notification, readAt }))
  );

  return notificationRepository.listByHome(homeId);
}

export async function deleteNotification(
  notificationId: string,
  context: NotificationRequestContext
): Promise<void> {
  const resolvedContext = await resolveContext(context);
  const homeId = requireHomeId(resolvedContext);
  const existing = assertHomeMatch(await requireNotification(notificationId), homeId);

  await notificationRepository.remove(existing.notificationId);
}

export const notificationTesting = {
  async reset() {
    await notificationRepository.reset();
  }
};
