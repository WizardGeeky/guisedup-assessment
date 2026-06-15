import { apiClient, ApiSuccess } from './apiClient';
import { ApiPost } from './feedApi';

export interface SearchResult {
  post: ApiPost;
  relevanceScore: number;
}

export const searchApi = {
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const res = await apiClient.get<ApiSuccess<SearchResult[]>>('/search', {
      params: { q: query, limit },
    });
    return res.data.data;
  },
};
