import type { AuthSession, NotificationRecord } from "@jenix/shared";
import { useCallback, useEffect, useState } from "react";

import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../services/notificationApi";

const REFRESH_INTERVAL_MS = 30_000;

export function useNotifications(session: AuthSession) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return listNotifications(session)
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [session]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));

    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function markRead(notificationId: string) {
    const updated = await markNotificationRead(session, notificationId);
    setNotifications((current) =>
      current.map((item) => (item.notificationId === updated.notificationId ? updated : item))
    );
  }

  async function markAllRead() {
    const updated = await markAllNotificationsRead(session);
    setNotifications(updated);
  }

  async function remove(notificationId: string) {
    await deleteNotification(session, notificationId);
    setNotifications((current) =>
      current.filter((item) => item.notificationId !== notificationId)
    );
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return { notifications, loading, unreadCount, refresh, markRead, markAllRead, remove };
}
