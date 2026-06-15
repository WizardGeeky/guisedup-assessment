import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS_TOKEN: '@guisedup:access_token',
  REFRESH_TOKEN: '@guisedup:refresh_token',
  USER: '@guisedup:user',
} as const;

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  },
  async getUser(): Promise<AuthUser | null> {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.ACCESS_TOKEN, accessToken],
      [KEYS.REFRESH_TOKEN, refreshToken],
    ]);
  },
  async setUser(user: AuthUser): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
  },
};

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
}
