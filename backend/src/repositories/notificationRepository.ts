import { Notification, NotificationType } from "@prisma/client";
import { prisma } from "../config/database";

export type NotificationWithFromUser = Notification & {
  fromUser: { id: string; username: string; avatarUrl: string | null } | null;
};

export const notificationRepository = {
  async create(data: {
    userId: string;
    fromUserId?: string;
    type: NotificationType;
    postId?: string;
    commentId?: string;
    message: string;
  }): Promise<Notification> {
    return prisma.notification.create({ data });
  },

  async findByUser(userId: string, limit = 30): Promise<NotificationWithFromUser[]> {
    return prisma.notification.findMany({
      where: { userId },
      include: { fromUser: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }) as Promise<NotificationWithFromUser[]>;
  },

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },
};
