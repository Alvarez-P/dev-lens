'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAuthSession } from './use-auth-session';
import { useAuthActions } from './use-auth-actions';
import { useIdentities } from './use-identities';
import type { AuthResponse, LoginCredentials, RegisterData, LinkedIdentity } from './auth-types';
import type { AuthState } from './auth-types';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  loginWithProvider: (provider: string) => void;
  getLinkedIdentities: () => Promise<LinkedIdentity[]>;
  unlinkIdentity: (identityId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactNode {
  const { state, setAuthenticated, setUnauthenticated } = useAuthSession();
  const actions = useAuthActions({ setAuthenticated, setUnauthenticated });
  const identities = useIdentities();

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        isLoading: state.isLoading,
        isAuthenticated: state.isAuthenticated,
        login: actions.login,
        register: actions.register,
        logout: actions.logout,
        loginWithProvider: actions.loginWithProvider,
        getLinkedIdentities: identities.getLinkedIdentities,
        unlinkIdentity: identities.unlinkIdentity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
