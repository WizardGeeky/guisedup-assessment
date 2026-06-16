import { apiClient, ApiSuccess } from './apiClient';

export interface ApiMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  isRead: boolean;
  createdAt: string;
  fromUser: { id: string; username: string; avatarUrl: string | null };
  toUser: { id: string; username: string; avatarUrl: string | null };
}

export interface ConversationPreview {
  userId: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface UserSearchResult {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

export const chatApi = {
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    if (!query.trim()) return [];
    const res = await apiClient.get<ApiSuccess<UserSearchResult[]>>('/users/search', {
      params: { q: query.trim() },
    });
    return res.data.data;
  },
  async getConversations(): Promise<ConversationPreview[]> {
    const res = await apiClient.get<ApiSuccess<ConversationPreview[]>>('/messages/conversations');
    return res.data.data;
  },

  async getConversation(userId: string): Promise<ApiMessage[]> {
    const res = await apiClient.get<ApiSuccess<ApiMessage[]>>(`/messages/conversations/${userId}`);
    return res.data.data;
  },

  async sendMessage(toUserId: string, text: string): Promise<ApiMessage> {
    const res = await apiClient.post<ApiSuccess<ApiMessage>>('/messages', { toUserId, text });
    return res.data.data;
  },
};
