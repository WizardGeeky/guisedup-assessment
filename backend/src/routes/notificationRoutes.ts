import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { notificationController } from "../controllers/notificationController";

export const notificationRouter = Router();

notificationRouter.get("/", authenticate, notificationController.getNotifications);
notificationRouter.get("/unread-count", authenticate, notificationController.getUnreadCount);
notificationRouter.post("/mark-read", authenticate, notificationController.markAllRead);
