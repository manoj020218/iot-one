import type { HomeAccessRole } from "@jenix/shared";

export interface NotificationRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface CreateNotificationInput {
  homeId: string;
  category: "alarm" | "home" | "system";
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  sourceType: "scene" | "home" | "system";
  sourceId?: string;
}

export class NotificationModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "NotificationModuleError";
  }
}
