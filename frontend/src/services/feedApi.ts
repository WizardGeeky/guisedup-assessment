import { apiClient, ApiSuccess } from './apiClient';

export interface ApiPost {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  authenticityScore: number;
  embeddingStatus: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  _count?: {
    interactions: number;
  };
}

export interface RankedPost {
  post: ApiPost;
  scores: {
    semantic: number;
    relationship: number;
    authenticity: number;
    timeDecay: number;
    final: number;
  };
}

export interface FeedPage {
  posts: RankedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const feedApi = {
  async getFeed(cursor?: string, limit = 20): Promise<FeedPage> {
    const params: Record<string, string | number> = { limit };
    if (cursor) params['cursor'] = cursor;

    const res = await apiClient.get<ApiSuccess<RankedPost[]>>('/feed', { params });

    return {
      posts: res.data.data,
      nextCursor: res.data.meta?.nextCursor ?? null,
      hasMore: res.data.meta?.hasMore ?? false,
    };
  },
};
