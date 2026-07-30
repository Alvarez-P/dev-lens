import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { storeTokens, clearTokens } from './token-storage';
import { loginRequest, registerRequest, logoutRequest } from './auth.service';
import type { AuthResponse, LoginCredentials, RegisterData, UserProfile } from './auth-types';

interface AuthActionsDeps {
  setAuthenticated: (user: UserProfile) => void;
  setUnauthenticated: () => void;
}

export function useAuthActions({ setAuthenticated, setUnauthenticated }: AuthActionsDeps) {
  const router = useRouter();

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      const result = await loginRequest(credentials);
      storeTokens(result.accessToken, result.refreshToken);
      setAuthenticated(result.user);
      return result;
    },
    [setAuthenticated],
  );

  const register = useCallback(
    async (data: RegisterData): Promise<AuthResponse> => {
      const result = await registerRequest(data);
      storeTokens(result.accessToken, result.refreshToken);
      setAuthenticated(result.user);
      return result;
    },
    [setAuthenticated],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch {
      void 0;
    }
    clearTokens();
    setUnauthenticated();
    router.push('/login');
  }, [router, setUnauthenticated]);

  const loginWithProvider = useCallback((provider: string): void => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/api/v1/auth/oauth/${provider}`;
  }, []);

  return { login, register, logout, loginWithProvider };
}
