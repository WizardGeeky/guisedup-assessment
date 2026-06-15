import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { config } from '../constants/config';
import { tokenStorage } from './tokenStorage';

// Shape of all backend responses
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    hasMore: boolean;
    nextCursor?: string;
    page?: number;
    pageSize?: number;
    total?: number;
  };
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

// Track ongoing refresh to prevent parallel refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: config.apiUrl,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Request interceptor — attach Bearer token
  client.interceptors.request.use(
    async (reqConfig: InternalAxiosRequestConfig) => {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
      return reqConfig;
    },
    (error: unknown) => Promise.reject(error),
  );

  // Response interceptor — handle 401 with token refresh
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // Queue this request until refresh completes
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return client(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = await tokenStorage.getRefreshToken();
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Call refresh endpoint without interceptors to avoid infinite loop
          const res = await axios.post<ApiSuccess<{ accessToken: string; refreshToken: string }>>(
            `${config.apiUrl}/auth/refresh`,
            { refreshToken },
          );

          const { accessToken, refreshToken: newRefresh } = res.data.data;
          await tokenStorage.setTokens(accessToken, newRefresh);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          processQueue(null, accessToken);

          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // Clear tokens — user needs to log in again
          await tokenStorage.clear();
          // Signal app to go back to auth screen
          authEventEmitter.emit('logout');
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

// Simple event emitter for signalling auth state changes to the navigation layer
type Listener = () => void;
class AuthEventEmitter {
  private listeners: Listener[] = [];
  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  emit(event: 'logout'): void {
    if (event === 'logout') this.listeners.forEach((fn) => fn());
  }
}
export const authEventEmitter = new AuthEventEmitter();

export const apiClient = createApiClient();

// Helper to extract error message from axios error
export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    return data?.error ?? error.message ?? 'Something went wrong';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
