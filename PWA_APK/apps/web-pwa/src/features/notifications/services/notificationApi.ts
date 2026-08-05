import {
  ensureDefaultHome,
  getCurrentHome as getSelectedHome,
  type AuthSession,
  type NotificationRecord
} from "@jenix/shared";

import {
  listDemoNotifications,
  removeDemoNotification,
  resetDemoNotifications,
  setDemoNotifications,
  upsertDemoNotification
} from "./notificationDemoStore";
import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import {
  fetchAuthenticatedJson,
  shouldUseDemoFallback
} from "../../../app/authenticatedRequest";

const notificationEndpoint = "/api/v1/notifications";

function getCurrentHome(session: AuthSession) {
  return getSelectedHome(
    ensureDefaultHome(session.homes, session.user.userId),
    session.user.userId,
    session.activeHomeId
  );
}

export async function listNotifications(session: AuthSession): Promise<NotificationRecord[]> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<NotificationRecord[]>(notificationEndpoint, session, {
      method: "GET",
      headers: createAuthenticatedHeaders(session, {
        homeId: currentHome.homeId
      })
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return listDemoNotifications(session.user.userId, currentHome.homeId);
  }
}

export async function markNotificationRead(
  session: AuthSession,
  notificationId: string
): Promise<NotificationRecord> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<NotificationRecord>(
      `${notificationEndpoint}/${encodeURIComponent(notificationId)}/read`,
      session,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    const notifications = listDemoNotifications(session.user.userId, currentHome.homeId);
    const existing = notifications.find((item) => item.notificationId === notificationId);

    if (!existing) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    const updated: NotificationRecord = {
      ...existing,
      readAt: existing.readAt ?? new Date().toISOString()
    };

    upsertDemoNotification(session.user.userId, currentHome.homeId, updated);
    return updated;
  }
}

export async function markAllNotificationsRead(
  session: AuthSession
): Promise<NotificationRecord[]> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<NotificationRecord[]>(
      `${notificationEndpoint}/mark-all-read`,
      session,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    const readAt = new Date().toISOString();
    const notifications = listDemoNotifications(session.user.userId, currentHome.homeId).map(
      (notification) => ({
        ...notification,
        readAt: notification.readAt ?? readAt
      })
    );

    setDemoNotifications(session.user.userId, currentHome.homeId, notifications);
    return notifications;
  }
}

export async function deleteNotification(
  session: AuthSession,
  notificationId: string
): Promise<{ notificationId: string }> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchAuthenticatedJson<{ notificationId: string }>(
      `${notificationEndpoint}/${encodeURIComponent(notificationId)}`,
      session,
      {
        method: "DELETE",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    removeDemoNotification(session.user.userId, currentHome.homeId, notificationId);
    return { notificationId };
  }
}

export const notificationApiTesting = {
  reset() {
    resetDemoNotifications();
  },
  seedDemoNotifications(userId: string, homeId: string, notifications: NotificationRecord[]) {
    setDemoNotifications(userId, homeId, notifications);
  }
};
