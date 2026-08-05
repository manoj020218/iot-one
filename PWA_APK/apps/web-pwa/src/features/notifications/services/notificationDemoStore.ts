import type { NotificationRecord } from "@jenix/shared";

const notificationDemoStore = new Map<string, NotificationRecord[]>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createKey(userId: string, homeId: string) {
  return `${userId}:${homeId}`;
}

function sortNewestFirst(notifications: NotificationRecord[]): NotificationRecord[] {
  return [...notifications].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function listDemoNotifications(userId: string, homeId: string): NotificationRecord[] {
  return clone(sortNewestFirst(notificationDemoStore.get(createKey(userId, homeId)) ?? []));
}

export function setDemoNotifications(
  userId: string,
  homeId: string,
  notifications: NotificationRecord[]
) {
  notificationDemoStore.set(createKey(userId, homeId), clone(sortNewestFirst(notifications)));
}

export function upsertDemoNotification(
  userId: string,
  homeId: string,
  notification: NotificationRecord
) {
  const notifications = listDemoNotifications(userId, homeId);
  const nextNotifications = [
    notification,
    ...notifications.filter((item) => item.notificationId !== notification.notificationId)
  ];

  setDemoNotifications(userId, homeId, nextNotifications);
}

export function removeDemoNotification(
  userId: string,
  homeId: string,
  notificationId: string
) {
  const notifications = listDemoNotifications(userId, homeId);
  setDemoNotifications(
    userId,
    homeId,
    notifications.filter((notification) => notification.notificationId !== notificationId)
  );
}

export function resetDemoNotifications() {
  notificationDemoStore.clear();
}
