import { apiClient, ApiSuccess } from './apiClient';
import { AuthUser } from './tokenStorage';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export const authApi = {
  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    const res = await apiClient.post<ApiSuccess<AuthResponse>>('/auth/register', {
      email,
      username,
      password,
    });
    return res.data.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiClient.post<ApiSuccess<AuthResponse>>('/auth/login', {
      email,
      password,
    });
    return res.data.data;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await apiClient.post<ApiSuccess<AuthTokens>>('/auth/refresh', {
      refreshToken,
    });
    return res.data.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  },

  async me(): Promise<{ userId: string; email: string; username: string }> {
    const res = await apiClient.get<ApiSuccess<{ userId: string; email: string; username: string }>>('/auth/me');
    return res.data.data;
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const res = await apiClient.post<ApiSuccess<{ resetToken: string }>>('/auth/verify-otp', { email, otp });
    return res.data.data;
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, newPassword });
  },
};
