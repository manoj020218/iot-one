export type NotificationCategory = "alarm" | "home" | "system";

export type NotificationSeverity = "critical" | "warning" | "info";

export type NotificationSourceType = "scene" | "home" | "system";

export interface NotificationRecord {
  notificationId: string;
  homeId: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  sourceType: NotificationSourceType;
  sourceId?: string;
  createdAt: string;
  readAt?: string;
}
