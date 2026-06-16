import { apiClient, ApiSuccess } from './apiClient';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

export const userApi = {
  async getMe(): Promise<UserProfile> {
    const res = await apiClient.get<ApiSuccess<UserProfile>>('/users/profile/me');
    return res.data.data;
  },

  async updateProfile(data: { bio?: string; avatarUrl?: string }): Promise<UserProfile> {
    const res = await apiClient.put<ApiSuccess<UserProfile>>('/users/profile', data);
    return res.data.data;
  },
};
