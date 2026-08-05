import type { NotificationRecord } from "@jenix/shared";
import { FiAlertTriangle, FiHome, FiSettings, FiTrash2 } from "react-icons/fi";

import { relativeTimeFrom } from "../utils/relativeTime";

export interface NotificationRowProps {
  notification: NotificationRecord;
  onOpen: (notification: NotificationRecord) => void;
  onDelete: (notification: NotificationRecord) => void;
}

const CATEGORY_ICON = {
  alarm: FiAlertTriangle,
  home: FiHome,
  system: FiSettings
} as const;

export function NotificationRow({ notification, onOpen, onDelete }: NotificationRowProps) {
  const Icon = CATEGORY_ICON[notification.category];
  const unread = !notification.readAt;

  return (
    <article className="panel home-list-item notification-row" data-unread={unread}>
      <button
        className="settings-row"
        onClick={() => onOpen(notification)}
        type="button"
      >
        <span
          className="settings-row-icon notification-row-icon"
          data-severity={notification.severity}
        >
          <Icon size={17} />
        </span>
        <span className="settings-row-label">
          <strong>
            {unread ? <span className="notification-row-dot" aria-hidden="true" /> : null}
            {notification.title}
          </strong>
          <span>{notification.body}</span>
        </span>
        <span className="notification-row-time">{relativeTimeFrom(notification.createdAt)}</span>
      </button>
      <button
        aria-label="Delete notification"
        className="notification-row-delete"
        onClick={() => onDelete(notification)}
        type="button"
      >
        <FiTrash2 size={16} />
      </button>
    </article>
  );
}
