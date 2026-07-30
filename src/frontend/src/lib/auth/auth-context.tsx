'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { get, post, del } from '@/lib/api-client';
import type {
  UserProfile,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  AuthState,
  LinkedIdentity,
} from './auth-types';

const ACCESS_TOKEN_KEY = 'devlens_access_token';
const REFRESH_TOKEN_KEY = 'devlens_refresh_token';

function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;

  register: (data: RegisterData) => Promise<AuthResponse>;

  logout: () => Promise<void>;

  refreshToken: () => Promise<AuthResponse | null>;

  loginWithProvider: (provider: string) => void;

  getLinkedIdentities: () => Promise<LinkedIdentity[]>;

  unlinkIdentity: (identityId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactNode {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  const attemptTokenRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return false;

    try {
      const result = await refreshTokens(refreshToken);
      if (result) {
        storeTokens(result.accessToken, result.refreshToken);
        setState({
          user: result.user,
          isLoading: false,
          isAuthenticated: true,
        });
        return true;
      }
    } catch {
      void 0;
    }
    return false;
  }, []);

  // Handle OAuth callback: store tokens from URL params before session restore
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success') {
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');
      if (accessToken && refreshToken) {
        storeTokens(accessToken, refreshToken);
        // Clean URL parameters without full page reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      const token = getStoredAccessToken();
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      try {
        const response = await get<{
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
          isEmailVerified: boolean;
          createdAt: string;
        }>('/api/v1/auth/me');
        if ('success' in response && response.success) {
          const { data } = response;
          setState({
            user: data as unknown as UserProfile,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          const refreshed = await attemptTokenRefresh();
          if (!refreshed) {
            clearTokens();
            setState({ user: null, isLoading: false, isAuthenticated: false });
          }
        }
      } catch {
        const refreshed = await attemptTokenRefresh();
        if (!refreshed) {
          clearTokens();
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      }
    };

    restoreSession();
  }, [attemptTokenRefresh]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await post<AuthResponse>('/api/v1/auth/login', credentials);

    if (!('success' in response) || !response.success) {
      throw new Error('Login failed');
    }

    const authResponse = response.data as unknown as AuthResponse;
    storeTokens(authResponse.accessToken, authResponse.refreshToken);

    setState({
      user: authResponse.user,
      isLoading: false,
      isAuthenticated: true,
    });

    return authResponse;
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<AuthResponse> => {
    const response = await post<AuthResponse>('/api/v1/auth/register', data);

    if (!('success' in response) || !response.success) {
      throw new Error('Registration failed');
    }

    const authResponse = response.data as unknown as AuthResponse;
    storeTokens(authResponse.accessToken, authResponse.refreshToken);

    setState({
      user: authResponse.user,
      isLoading: false,
      isAuthenticated: true,
    });

    return authResponse;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await post('/api/v1/auth/logout');
    } catch {
      void 0;
    }

    clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push('/login');
  }, [router]);

  const refreshToken = useCallback(async (): Promise<AuthResponse | null> => {
    const stored = getStoredRefreshToken();
    if (!stored) return null;

    try {
      const result = await refreshTokens(stored);
      if (result) {
        storeTokens(result.accessToken, result.refreshToken);
        setState({
          user: result.user,
          isLoading: false,
          isAuthenticated: true,
        });
        return result;
      }
    } catch {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
    return null;
  }, []);

  const loginWithProvider = useCallback((provider: string): void => {
    if (typeof window === 'undefined') return;
    window.location.href = `/api/v1/auth/oauth/${provider}`;
  }, []);

  const getLinkedIdentities = useCallback(async (): Promise<LinkedIdentity[]> => {
    const response = await get<LinkedIdentity[]>('/api/v1/users/identities');
    if ('success' in response && response.success) {
      return response.data;
    }
    return [];
  }, []);

  const unlinkIdentity = useCallback(async (identityId: string): Promise<void> => {
    const response = await del<{ message: string }>(`/api/v1/users/identities/${identityId}`);
    if (!('success' in response) || !response.success) {
      throw new Error('Failed to unlink identity');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        isLoading: state.isLoading,
        isAuthenticated: state.isAuthenticated,
        login,
        register,
        logout,
        refreshToken,
        loginWithProvider,
        getLinkedIdentities,
        unlinkIdentity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

async function refreshTokens(refreshToken: string): Promise<AuthResponse | null> {
  const response = await post<AuthResponse>('/api/v1/auth/refresh', {
    refreshToken,
  });

  if ('success' in response && response.success) {
    return response.data as unknown as AuthResponse;
  }
  return null;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
