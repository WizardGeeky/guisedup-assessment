import { apiClient, ApiSuccess } from './apiClient';

export type InteractionType = 'VIEW' | 'REPLY' | 'REACTION';

export interface Interaction {
  id: string;
  userId: string;
  postId: string;
  type: InteractionType;
  createdAt: string;
}

export interface InteractionCounts {
  postId: string;
  viewCount: number;
  replyCount: number;
  reactionCount: number;
  totalCount: number;
}

export const interactionApi = {
  async logInteraction(postId: string, type: InteractionType): Promise<Interaction> {
    const res = await apiClient.post<ApiSuccess<Interaction>>('/interactions', {
      postId,
      type,
    });
    return res.data.data;
  },

  async getPostInteractions(postId: string): Promise<InteractionCounts> {
    const res = await apiClient.get<ApiSuccess<InteractionCounts>>(
      `/interactions/post/${postId}`,
    );
    return res.data.data;
  },
};
