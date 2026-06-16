import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { authApi } from '../services/authApi';
import { tokenStorage, AuthUser } from '../services/tokenStorage';
import { authEventEmitter, getApiError } from '../services/apiClient';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserProfile: (patch: Partial<Pick<AuthUser, 'avatarUrl' | 'bio'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Hydrate auth state from storage on mount
  useEffect(() => {
    let mounted = true;

    const hydrateAuth = async (): Promise<void> => {
      try {
        const [accessToken, user] = await Promise.all([
          tokenStorage.getAccessToken(),
          tokenStorage.getUser(),
        ]);

        if (mounted) {
          if (accessToken && user) {
            setState({ user, isAuthenticated: true, isLoading: false });
          } else {
            setState({ user: null, isAuthenticated: false, isLoading: false });
          }
        }
      } catch {
        if (mounted) {
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      }
    };

    void hydrateAuth();

    // Listen for forced logout from token refresh failure
    const unsubscribe = authEventEmitter.on(() => {
      if (mounted) {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const result = await authApi.login(email, password);
    await tokenStorage.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    await tokenStorage.setUser(result.user);
    setState({ user: result.user, isAuthenticated: true, isLoading: false });
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string): Promise<void> => {
      const result = await authApi.register(email, username, password);
      await tokenStorage.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      await tokenStorage.setUser(result.user);
      setState({ user: result.user, isAuthenticated: true, isLoading: false });
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore errors — always clear local storage
    } finally {
      await tokenStorage.clear();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const user = await tokenStorage.getUser();
      if (user) {
        setState((prev) => ({ ...prev, user }));
      }
    } catch {
      // Ignore
    }
  }, []);

  const updateUserProfile = useCallback(
    async (patch: Partial<Pick<AuthUser, 'avatarUrl' | 'bio'>>): Promise<void> => {
      try {
        const current = await tokenStorage.getUser();
        if (!current) return;
        const updated: AuthUser = { ...current, ...patch };
        await tokenStorage.setUser(updated);
        setState((prev) => ({ ...prev, user: updated }));
      } catch {
        // Ignore
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshUser,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { getApiError };
