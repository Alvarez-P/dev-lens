'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import type {
  UserProfile,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  AuthState,
} from './auth-types';

// ─── Constants ──────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'devlens_access_token';
const REFRESH_TOKEN_KEY = 'devlens_refresh_token';

// ─── Token Storage Helpers ──────────────────────────────────────

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

// ─── Context ────────────────────────────────────────────────────

interface AuthContextType extends AuthState {
  /** Login with email and password. Returns the auth response. */
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  /** Register a new user. Returns the auth response. */
  register: (data: RegisterData) => Promise<AuthResponse>;
  /** Logout the current user. */
  logout: () => Promise<void>;
  /** Refresh the access token. Returns the new auth response. */
  refreshToken: () => Promise<AuthResponse | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  /**
   * Attempt to refresh the access token using the stored refresh token.
   */
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
      // Refresh failed
    }
    return false;
  }, []);

  /**
   * On mount, try to restore the session by calling /auth/me.
   */
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
          // Token invalid, try refresh
          const refreshed = await attemptTokenRefresh();
          if (!refreshed) {
            clearTokens();
            setState({ user: null, isLoading: false, isAuthenticated: false });
          }
        }
      } catch {
        // Token invalid/expired, try refresh
        const refreshed = await attemptTokenRefresh();
        if (!refreshed) {
          clearTokens();
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      }
    };

    restoreSession();
  }, [attemptTokenRefresh]);

  /**
   * Login with email and password.
   */
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

  /**
   * Register a new user.
   */
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

  /**
   * Logout the current user.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await post('/api/v1/auth/logout');
    } catch {
      // Logout fails silently — we clear local state regardless
    }

    clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push('/login');
  }, [router]);

  /**
   * Refresh the access token.
   */
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Helper: call refresh token endpoint ─────────────────────────

async function refreshTokens(refreshToken: string): Promise<AuthResponse | null> {
  const response = await post<AuthResponse>('/api/v1/auth/refresh', {
    refreshToken,
  });

  if ('success' in response && response.success) {
    return response.data as unknown as AuthResponse;
  }
  return null;
}

// ─── Hook ────────────────────────────────────────────────────────

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
