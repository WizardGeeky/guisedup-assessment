import { apiClient, ApiSuccess } from './apiClient';
import { ApiPost } from './feedApi';

export interface CreatePostInput {
  text: string;
  imageUrl?: string;
}

export interface CreatePostResult {
  post: ApiPost;
  embeddingStatus: string;
}

export const postApi = {
  async createPost(input: CreatePostInput): Promise<CreatePostResult> {
    const res = await apiClient.post<ApiSuccess<CreatePostResult>>('/posts', input);
    return res.data.data;
  },

  async getPost(id: string): Promise<ApiPost> {
    const res = await apiClient.get<ApiSuccess<ApiPost>>(`/posts/${id}`);
    return res.data.data;
  },

  async getUserPosts(): Promise<ApiPost[]> {
    const res = await apiClient.get<ApiSuccess<ApiPost[]>>('/posts/user/me');
    return res.data.data;
  },
};
