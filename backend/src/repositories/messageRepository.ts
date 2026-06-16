import { Message } from "@prisma/client";
import { prisma } from "../config/database";

export type MessageWithUsers = Message & {
  fromUser: { id: string; username: string; avatarUrl: string | null };
  toUser: { id: string; username: string; avatarUrl: string | null };
};

export type ConversationPreview = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
};

export const messageRepository = {
  async send(fromUserId: string, toUserId: string, text: string): Promise<MessageWithUsers> {
    return prisma.message.create({
      data: { fromUserId, toUserId, text },
      include: {
        fromUser: { select: { id: true, username: true, avatarUrl: true } },
        toUser: { select: { id: true, username: true, avatarUrl: true } },
      },
    }) as Promise<MessageWithUsers>;
  },

  async getConversation(userA: string, userB: string, limit = 50): Promise<MessageWithUsers[]> {
    return prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: userA, toUserId: userB },
          { fromUserId: userB, toUserId: userA },
        ],
      },
      include: {
        fromUser: { select: { id: true, username: true, avatarUrl: true } },
        toUser: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    }) as Promise<MessageWithUsers[]>;
  },

  async markRead(fromUserId: string, toUserId: string): Promise<void> {
    await prisma.message.updateMany({
      where: { fromUserId, toUserId, isRead: false },
      data: { isRead: true },
    });
  },

  async getConversationList(userId: string): Promise<ConversationPreview[]> {
    const messages = await prisma.message.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      include: {
        fromUser: { select: { id: true, username: true, avatarUrl: true } },
        toUser: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }) as MessageWithUsers[];

    const seen = new Map<string, ConversationPreview>();
    for (const msg of messages) {
      const other = msg.fromUserId === userId ? msg.toUser : msg.fromUser;
      if (!seen.has(other.id)) {
        const unreadCount = await prisma.message.count({
          where: { fromUserId: other.id, toUserId: userId, isRead: false },
        });
        seen.set(other.id, {
          userId: other.id,
          username: other.username,
          avatarUrl: other.avatarUrl,
          lastMessage: msg.text,
          lastMessageAt: msg.createdAt,
          unreadCount,
        });
      }
    }
    return Array.from(seen.values());
  },
};
