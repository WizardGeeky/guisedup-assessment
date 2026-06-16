import { Request, Response, NextFunction } from "express";
import { notificationService } from "../services/notificationService";
import { sendSuccess } from "../utils/apiResponse";

export const notificationController = {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notifications = await notificationService.getNotifications(userId);
      sendSuccess(res, notifications);
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await notificationService.markAllRead(userId);
      sendSuccess(res, null, 200, undefined, "Notifications marked as read");
    } catch (err) {
      next(err);
    }
  },

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const count = await notificationService.getUnreadCount(userId);
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  },
};
