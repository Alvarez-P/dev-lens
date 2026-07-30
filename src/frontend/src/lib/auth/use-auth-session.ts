import { useReducer, useEffect } from 'react';
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from './token-storage';
import { refreshTokenRequest, fetchCurrentUser } from './auth.service';
import type { UserProfile, AuthState } from './auth-types';

type Action =
  { type: 'AUTHENTICATED'; user: UserProfile } | { type: 'UNAUTHENTICATED' } | { type: 'LOADING' };

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'AUTHENTICATED':
      return { user: action.user, isLoading: false, isAuthenticated: true };
    case 'UNAUTHENTICATED':
      return { user: null, isLoading: false, isAuthenticated: false };
    case 'LOADING':
      return { ...state, isLoading: true };
    default:
      return state;
  }
}

interface AuthSessionResult {
  state: AuthState;
  setAuthenticated: (user: UserProfile) => void;
  setUnauthenticated: () => void;
  setLoading: () => void;
}

export function useAuthSession(): AuthSessionResult {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const token = getAccessToken();
      if (!token) {
        dispatch({ type: 'UNAUTHENTICATED' });
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          dispatch({ type: 'AUTHENTICATED', user });
        }
      } catch {
        if (cancelled) return;
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearTokens();
          dispatch({ type: 'UNAUTHENTICATED' });
          return;
        }
        try {
          const result = await refreshTokenRequest(refreshToken);
          storeTokens(result.accessToken, result.refreshToken);
          if (!cancelled) {
            dispatch({ type: 'AUTHENTICATED', user: result.user });
          }
        } catch {
          clearTokens();
          if (!cancelled) dispatch({ type: 'UNAUTHENTICATED' });
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    state,
    setAuthenticated: (user) => dispatch({ type: 'AUTHENTICATED', user }),
    setUnauthenticated: () => dispatch({ type: 'UNAUTHENTICATED' }),
    setLoading: () => dispatch({ type: 'LOADING' }),
  };
}
