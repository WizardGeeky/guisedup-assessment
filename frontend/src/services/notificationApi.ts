import { apiClient, ApiSuccess } from './apiClient';

export interface ApiNotification {
  id: string;
  userId: string;
  fromUserId: string | null;
  type: 'COMMENT' | 'REACTION' | 'MENTION' | 'MESSAGE';
  postId: string | null;
  commentId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
}

export const notificationApi = {
  async getNotifications(): Promise<ApiNotification[]> {
    const res = await apiClient.get<ApiSuccess<ApiNotification[]>>('/notifications');
    return res.data.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get<ApiSuccess<{ count: number }>>('/notifications/unread-count');
    return res.data.data.count;
  },

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/mark-read');
  },
};
