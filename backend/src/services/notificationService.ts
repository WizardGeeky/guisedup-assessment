import { notificationRepository, NotificationWithFromUser } from "../repositories/notificationRepository";

export const notificationService = {
  async getNotifications(userId: string): Promise<NotificationWithFromUser[]> {
    return notificationRepository.findByUser(userId);
  },

  async markAllRead(userId: string): Promise<void> {
    return notificationRepository.markAllRead(userId);
  },

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  },
};
