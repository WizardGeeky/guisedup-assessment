import { apiClient, ApiSuccess } from './apiClient';

export interface ApiComment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

export const commentApi = {
  async getComments(postId: string): Promise<ApiComment[]> {
    const res = await apiClient.get<ApiSuccess<ApiComment[]>>(`/posts/${postId}/comments`);
    return res.data.data;
  },

  async addComment(postId: string, text: string): Promise<ApiComment> {
    const res = await apiClient.post<ApiSuccess<ApiComment>>(`/posts/${postId}/comments`, { text });
    return res.data.data;
  },

  async deleteComment(postId: string, commentId: string): Promise<void> {
    await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
  },
};
