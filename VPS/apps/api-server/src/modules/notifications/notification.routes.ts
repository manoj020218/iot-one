import { Router, type Router as ExpressRouter } from "express";

import {
  deleteNotificationController,
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController
} from "./notification.controller";

export const notificationRouter: ExpressRouter = Router();

notificationRouter.get("/", listNotificationsController);
notificationRouter.post("/mark-all-read", markAllNotificationsReadController);
notificationRouter.patch("/:notificationId/read", markNotificationReadController);
notificationRouter.delete("/:notificationId", deleteNotificationController);
