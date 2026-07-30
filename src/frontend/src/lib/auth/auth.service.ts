import { post, get, del, isSuccessResponse } from '@/lib/api-client';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  LinkedIdentity,
  UserProfile,
} from './auth-types';

export async function loginRequest(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/v1/auth/login', credentials);
  if (!isSuccessResponse(response)) {
    throw new Error('Login failed');
  }
  return response.data;
}

export async function registerRequest(data: RegisterData): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/v1/auth/register', data);
  if (!isSuccessResponse(response)) {
    throw new Error('Registration failed');
  }
  return response.data;
}

export async function logoutRequest(): Promise<void> {
  await post('/api/v1/auth/logout');
}

export async function refreshTokenRequest(refreshToken: string): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/v1/auth/refresh', { refreshToken });
  if (!isSuccessResponse(response)) {
    throw new Error('Token refresh failed');
  }
  return response.data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const response = await get<UserProfile>('/api/v1/auth/me');
  if (!isSuccessResponse(response)) {
    throw new Error('Failed to fetch current user');
  }
  return response.data;
}

export async function fetchLinkedIdentities(): Promise<LinkedIdentity[]> {
  const response = await get<LinkedIdentity[]>('/api/v1/users/identities');
  if (!isSuccessResponse(response)) {
    return [];
  }
  return response.data;
}

export async function unlinkIdentityRequest(identityId: string): Promise<void> {
  const response = await del<{ message: string }>(`/api/v1/users/identities/${identityId}`);
  if (!isSuccessResponse(response)) {
    throw new Error('Failed to unlink identity');
  }
}
