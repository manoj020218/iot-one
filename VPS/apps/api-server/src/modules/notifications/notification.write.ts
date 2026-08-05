import type { NotificationRecord } from "@jenix/shared";

import { notificationRepository } from "./notification.model";
import type { CreateNotificationInput } from "./notification.types";

function createNotificationId(): string {
  return `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Called directly by other backend modules (scene action-worker, home
 * service) when something notification-worthy happens. Deliberately has no
 * dependency on the homes module (unlike notification.service.ts, which
 * needs resolveHomeAccessContext for the read/user-facing side) so modules
 * like home.service.ts can call it without creating an import cycle.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationRecord> {
  const record: NotificationRecord = {
    notificationId: createNotificationId(),
    homeId: input.homeId,
    category: input.category,
    severity: input.severity,
    title: input.title,
    body: input.body,
    sourceType: input.sourceType,
    createdAt: new Date().toISOString(),
    ...(input.sourceId ? { sourceId: input.sourceId } : {})
  };

  return notificationRepository.save(record);
}
