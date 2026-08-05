import type { NotificationRecord } from "@jenix/shared";
import { AppShell } from "@jenix/ui";
import { FiArrowLeft, FiBell } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { NotificationRow } from "./components/NotificationRow";
import { useNotifications } from "./hooks/useNotifications";

export function NotificationCenterPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    throw new Error("NotificationCenterPage requires an authenticated session");
  }

  const { notifications, loading, unreadCount, markRead, markAllRead, remove } =
    useNotifications(session);

  function handleOpen(notification: NotificationRecord) {
    if (!notification.readAt) {
      void markRead(notification.notificationId);
    }
  }

  return (
    <AppShell
      eyebrow="Alerts & Updates"
      title="Notifications"
      aside={
        unreadCount > 0 ? (
          <button className="text-button" onClick={() => void markAllRead()} type="button">
            Mark all read
          </button>
        ) : undefined
      }
    >
      <button className="editor-back" onClick={() => navigate("/home")} type="button">
        <FiArrowLeft size={16} />
        Home
      </button>

      {loading ? <section className="panel">Loading notifications...</section> : null}

      {!loading && notifications.length === 0 ? (
        <div className="empty-state">
          <FiBell size={28} style={{ color: "var(--faint)" }} />
          <h2>You&apos;re all caught up</h2>
          <p>Alarms from your scenes and updates about your HOME will show up here.</p>
        </div>
      ) : null}

      {!loading && notifications.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.notificationId}
              notification={notification}
              onDelete={(item) => void remove(item.notificationId)}
              onOpen={handleOpen}
            />
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
